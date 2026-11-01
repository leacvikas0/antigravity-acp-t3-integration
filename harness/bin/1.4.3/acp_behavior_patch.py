"""Load the user-selected behavioral core through native templated instructions."""
import hashlib
import json
import logging
import os
from pathlib import Path


def apply_behavior(config, policy, core, preferences='', profile='', media=''):
    if not isinstance(policy.get('enabled'), bool):
        raise ValueError('Behavior policy enabled must be boolean')
    if policy.get('model') != 'gemini-4-argon':
        raise ValueError('Behavior policy is restricted to gemini-4-argon')
    if policy.get('mode') != 'templated_identity':
        raise ValueError('Behavior policy mode must be templated_identity')
    if not policy['enabled']:
        return None
    if not any(model.name == policy['model'] for model in config.models):
        return None
    core = core.strip()
    if not core:
        raise ValueError('Behavior core must not be empty')
    instructions = config.system_instructions
    if instructions.HasField('custom'):
        raise ValueError('Behavior identity override conflicts with explicit custom system instructions')
    # SDK TemplatedSystemInstructions(identity=core) maps to exactly this field.
    # Keep all appended sections and all other native configuration untouched.
    instructions.appended.custom_identity = core
    sections = instructions.appended.appended_sections
    owned = {'argon_user_preferences', 'argon_user_profile', 'argon_media_capabilities'}
    for index in range(len(sections) - 1, -1, -1):
        if sections[index].title in owned:
            del sections[index]
    for title, content in [('argon_user_preferences', preferences), ('argon_user_profile', profile), ('argon_media_capabilities', media)]:
        if content.strip():
            sections.add(title=title, content=content.strip())
    return {'mode': policy['mode'], 'model': policy['model'],
            'core_characters': len(core),
            'core_sha256': hashlib.sha256(core.encode('utf-8')).hexdigest(),
            'preferences_characters': len(preferences.strip()),
            'profile_characters': len(profile.strip())}


def install():
    from google.antigravity.connections.local.local_connection import LocalConnectionStrategy
    if getattr(LocalConnectionStrategy, '_argon_behavior_policy_installed', False):
        return
    original = LocalConnectionStrategy._build_harness_config
    root = Path(__file__).resolve().parents[2]

    def read_optional(name):
        try:
            return (root / name).read_text(encoding='utf-8')
        except FileNotFoundError:
            return ''

    def build(self):
        config = original(self)
        policy = json.loads((root / 'behavior-policy.json').read_text(encoding='utf-8'))
        core = (root / 'behavior.md').read_text(encoding='utf-8') if policy.get('enabled') else ''
        preferences = read_optional('user-preferences.md') if policy.get('enabled') else ''
        profile = read_optional('user-profile.md') if policy.get('enabled') else ''
        media = read_optional('media-instructions.md') if policy.get('enabled') else ''
        result = apply_behavior(config, policy, core, preferences, profile, media)
        if result is not None:
            logging.info('Argon native behavior policy: %s', result)
            evidence = os.environ.get('ARGON_BEHAVIOR_POLICY_EVIDENCE')
            if evidence:
                Path(evidence).write_text(json.dumps(result, indent=2), encoding='utf-8')
        return config

    LocalConnectionStrategy._build_harness_config = build
    LocalConnectionStrategy._argon_behavior_policy_installed = True


if __name__ == '__acp_behavior_patch__':
    install()
