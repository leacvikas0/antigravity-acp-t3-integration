import runpy
import unittest
from pathlib import Path
from types import SimpleNamespace as N

module = runpy.run_path(str(Path(__file__).resolve().parents[1] / 'candidate/acp-1.4.3/acp_context_patch.py'))

def usage(**kwargs):
    values=dict(total_token_count=None,prompt_token_count=None,cached_content_token_count=None,candidates_token_count=None,thoughts_token_count=None)
    return N(**(values | kwargs))

class Tests(unittest.TestCase):
    def count(self, **kwargs):
        return module['extract_context_tokens_used'](usage(**kwargs))

    def test_cached_total_is_not_counted_twice(self):
        self.assertEqual(self.count(total_token_count=500030,prompt_token_count=1000,cached_content_token_count=499000,candidates_token_count=30),500030)

    def test_uncached_total_remains_unchanged(self):
        self.assertEqual(self.count(total_token_count=5030,prompt_token_count=5000,candidates_token_count=30),5030)

    def test_without_total_adds_disjoint_native_counts(self):
        self.assertEqual(self.count(prompt_token_count=1000,cached_content_token_count=499000,candidates_token_count=30,thoughts_token_count=20),500050)

    def test_empty_and_negative_counts(self):
        self.assertIsNone(self.count())
        self.assertEqual(self.count(total_token_count=0),0)
        self.assertEqual(self.count(total_token_count=-4),0)

if __name__=='__main__':unittest.main()
