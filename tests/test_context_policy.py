import copy
import runpy
import unittest
from pathlib import Path
from types import SimpleNamespace as N

module = runpy.run_path(str(Path(__file__).resolve().parents[1]/'candidate/acp-1.4.3/acp_context_patch.py'))
apply = module['apply_policy']
validate = module['validate_policy']
POLICY = dict(enabled=True,model='gemini-4-argon',context_window_tokens=1048576,
              compaction_ratio=.93,max_output_tokens=32768,use_model_reported_token_count=True)

class Model:
    def __init__(self,name):
        self.name=name;self.gemini_api_endpoint=N(options=N(max_output_tokens=0,thinking_level='high'))
        self.vertex_endpoint=N(options=N(max_output_tokens=0))
    def HasField(self,name):return name=='gemini_api_endpoint'

def config():
    return N(models=[Model('gemini-4-argon'),Model('image-model')],compaction_threshold=0,
             compaction_config=N(max_context_tokens=0,token_threshold=0,checkpoint_interval_tokens=0,
                                 use_model_reported_token_count=False))

class Tests(unittest.TestCase):
    def test_sets_native_fields_and_leaves_other_models_alone(self):
        c=config();result=apply(c,POLICY)
        self.assertEqual(result['compaction_threshold_tokens'],975175)
        self.assertEqual(c.compaction_config.max_context_tokens,1048576)
        self.assertEqual(c.compaction_config.token_threshold,975175)
        self.assertEqual(c.compaction_config.checkpoint_interval_tokens,975175)
        self.assertEqual(c.models[0].gemini_api_endpoint.options.max_output_tokens,32768)
        self.assertEqual(c.models[0].gemini_api_endpoint.options.thinking_level,'high')
        self.assertEqual(c.models[1].gemini_api_endpoint.options.max_output_tokens,0)
    def test_128k_reserves_shared_window_headroom(self):
        c=config();result=apply(c,dict(POLICY,max_output_tokens=131072))
        self.assertEqual(result['compaction_threshold_tokens'],917504)
        self.assertEqual(c.models[0].gemini_api_endpoint.options.max_output_tokens,131072)
        self.assertEqual(c.compaction_config.max_context_tokens,1048576)
    def test_disabled_policy_changes_nothing(self):
        c=config();before=copy.deepcopy(c)
        self.assertIsNone(apply(c,dict(POLICY,enabled=False)))
        self.assertEqual(c.compaction_config,before.compaction_config)
        self.assertEqual(c.compaction_threshold,0)
    def test_non_argon_session_changes_nothing(self):
        c=config();c.models=[Model('other')]
        self.assertIsNone(apply(c,POLICY));self.assertEqual(c.compaction_threshold,0)
    def test_rejects_invalid_capacity_ratio_and_output_headroom(self):
        for changes in [dict(context_window_tokens=2000000),dict(max_output_tokens=1048577),
                        dict(compaction_ratio=0),dict(compaction_ratio=float('nan')),
                        dict(max_output_tokens=0),dict(model='other')]:
            with self.subTest(changes=changes),self.assertRaises((ValueError,ArithmeticError)):
                validate(dict(POLICY,**changes))

if __name__=='__main__':unittest.main()
