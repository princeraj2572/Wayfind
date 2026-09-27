from app.search.fuse import rrf


def test_item_in_both_lists_beats_item_in_one():
    ranked = rrf([[1, 2, 3], [3, 4, 1]])
    ids = [i for i, _ in ranked]
    assert ids[:2] == [1, 3]  # both lists; 1 is ranked 1st+3rd, 3 is 3rd+1st -> tie broken by id
    assert set(ids) == {1, 2, 3, 4}


def test_scores_use_k():
    (only, score), = rrf([[7]], k=60)
    assert only == 7 and abs(score - 1 / 61) < 1e-12


def test_empty_input():
    assert rrf([]) == []
    assert rrf([[], []]) == []
