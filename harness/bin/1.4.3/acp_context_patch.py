"""Pass explicit context policy into the existing native harness configuration."""
import json
import logging
import os
from decimal import Decimal, ROUND_FLOOR
from pathlib import Path


def validate_policy(policy):
    if not isinstance(policy.get('enabled'), bool):
        raise ValueError('Context policy enabled must be boolean')
    if policy.get('model') != 'gemini-4-argon':
        raise ValueError('Context policy is restricted to gemini-4-argon')
    context = policy['context_window_tokens']
    output = policy['max_output_tokens']
    ratio = Decimal(str(policy['compaction_ratio']))
    if type(context) is not int or not 1 <= context <= 1048576:
        raise ValueError('Context policy exceeds the verified Argon capacity')
    if type(output) is not int or not 1 <= output <= min(131072, context - 1):
        raise ValueError('Output policy exceeds the supported continuation limit')
    if not ratio.is_finite() or not 0 < ratio < 1:
        raise ValueError('Compaction ratio must be between zero and one')
    threshold = int((Decimal(context) * ratio).to_integral_value(rounding=ROUND_FLOOR))
    # Argon shares its context between input, thinking and generated output.
    threshold = min(threshold, context - output)
    if not isinstance(policy.get('use_model_reported_token_count'), bool):
        raise ValueError('Model token-count preference must be boolean')
    return context, threshold, output


def apply_policy(config, policy):
    context, threshold, output = validate_policy(policy)
    if not policy['enabled']:
        return None
    models = [model for model in config.models if model.name == policy['model']]
    if not models:
        return None
    before = {
        'compaction_threshold': config.compaction_threshold,
        'max_context_tokens': config.compaction_config.max_context_tokens,
        'token_threshold': config.compaction_config.token_threshold,
        'checkpoint_interval_tokens': config.compaction_config.checkpoint_interval_tokens,
    }
    config.compaction_threshold = threshold
    config.compaction_config.max_context_tokens = context
    config.compaction_config.token_threshold = threshold
    config.compaction_config.checkpoint_interval_tokens = threshold
    config.compaction_config.use_model_reported_token_count = policy['use_model_reported_token_count']
    for model in models:
        if model.HasField('gemini_api_endpoint'):
            model.gemini_api_endpoint.options.max_output_tokens = output
        elif model.HasField('vertex_endpoint'):
            model.vertex_endpoint.options.max_output_tokens = output
        else:
            raise ValueError('Argon context policy requires a native Gemini endpoint')
    return {
        'context_window_tokens': context,
        'compaction_threshold_tokens': threshold,
        'checkpoint_interval_tokens': threshold,
        'max_output_tokens': output,
        'use_model_reported_token_count': policy['use_model_reported_token_count'],
        'previous_native_config': before,
    }


def extract_context_tokens_used(usage):
    """Gateway totals already include cached tokens; do not add cache twice.

    Native prompt counts exclude cache, so the no-total fallback sums those
    disjoint fields. This is display occupancy, not compaction policy.
    """
    if usage.total_token_count is not None:
        return max(usage.total_token_count, 0)
    counts = [usage.prompt_token_count, usage.cached_content_token_count,
              usage.candidates_token_count, usage.thoughts_token_count]
    if all(value is None for value in counts):
        return None
    return sum(max(value or 0, 0) for value in counts)


def install():
    from google.antigravity.connections.local.local_connection import LocalConnectionStrategy
    from google3.cloud.developer_experience.antigravity_extensions.acp_server import server as acp_server
    acp_server._extract_tokens_used = extract_context_tokens_used
    if getattr(LocalConnectionStrategy, '_argon_context_policy_installed', False):
        return
    original = LocalConnectionStrategy._build_harness_config

    def build(self):
        config = original(self)
        policy_path = Path(__file__).with_name('context-policy.json')
        policy = json.loads(policy_path.read_text(encoding='utf-8'))
        result = apply_policy(config, policy)
        if result is not None:
            logging.info('Argon native context policy: %s', result)
            evidence = os.environ.get('ARGON_CONTEXT_POLICY_EVIDENCE')
            if evidence:
                # Only numeric configuration, never endpoint keys or conversation text.
                Path(evidence).write_text(json.dumps(result, indent=2), encoding='utf-8')
        return config

    LocalConnectionStrategy._build_harness_config = build
    LocalConnectionStrategy._argon_context_policy_installed = True


if __name__ == '__acp_context_patch__':
    install()
