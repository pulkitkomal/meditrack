import logging
from typing import List, Optional
import numpy as np

logger = logging.getLogger(__name__)

_model = None
_model_name = "sentence-transformers/all-MiniLM-L6-v2"


def get_embedding_model():
    global _model
    if _model is None:
        try:
            from sentence_transformers import SentenceTransformer
            logger.info(f"[EMBEDDINGS] Loading embedding model: {_model_name}")
            _model = SentenceTransformer(_model_name)
            logger.info(f"[EMBEDDINGS] Embedding model loaded successfully")
        except Exception as e:
            logger.error(f"[EMBEDDINGS] Failed to load embedding model: {e}", exc_info=True)
            raise
    return _model


async def embed_text(text: str) -> List[float]:
    try:
        model = get_embedding_model()
        embedding = model.encode(text, convert_to_numpy=True)
        return embedding.tolist()
    except Exception as e:
        logger.error(f"[EMBEDDINGS] Failed to embed text: {e}", exc_info=True)
        raise


async def embed_texts(texts: List[str]) -> List[List[float]]:
    try:
        model = get_embedding_model()
        embeddings = model.encode(texts, convert_to_numpy=True, show_progress_bar=False)
        return [emb.tolist() for emb in embeddings]
    except Exception as e:
        logger.error(f"[EMBEDDINGS] Failed to embed texts: {e}", exc_info=True)
        raise


def cosine_similarity(vec1: List[float], vec2: List[float]) -> float:
    v1 = np.array(vec1)
    v2 = np.array(vec2)
    dot_product = np.dot(v1, v2)
    norm1 = np.linalg.norm(v1)
    norm2 = np.linalg.norm(v2)
    if norm1 == 0 or norm2 == 0:
        return 0.0
    return float(dot_product / (norm1 * norm2))


async def find_similar_chunks(
    query_embedding: List[float],
    chunks: List[dict],
    top_k: int = 20
) -> List[dict]:
    similarities = []
    for chunk in chunks:
        if "embedding" in chunk and chunk["embedding"]:
            sim = cosine_similarity(query_embedding, chunk["embedding"])
            similarities.append((sim, chunk))
    
    similarities.sort(key=lambda x: x[0], reverse=True)
    return [chunk for _, chunk in similarities[:top_k]]