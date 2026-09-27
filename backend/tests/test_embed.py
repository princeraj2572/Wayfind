from app.ingest.embed import embed_texts


def test_embeddings_have_expected_shape_and_meaning():
    a, b, c = embed_texts(["How do I get a refund?", "Refund policy for purchases", "VPN setup on Windows"])
    assert len(a) == 384

    def dot(x, y):
        return sum(i * j for i, j in zip(x, y))

    assert dot(a, b) > dot(a, c)


def test_empty_input_gives_empty_output():
    assert embed_texts([]) == []
