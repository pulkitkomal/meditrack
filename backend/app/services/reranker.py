import logging
from typing import List, Tuple
from sentence_transformers import CrossEncoder

logger = logging.getLogger(__name__)

_model = None
_model_name = "cross-encoder/ms-marco-MiniLM-L-6-v2"


def get_reranker_model():
    global _model
    if _model is None:
        try:
            logger.info(f"[RERANKER] Loading cross-encoder model: {_model_name}")
            _model = CrossEncoder(_model_name)
            logger.info(f"[RERANKER] Cross-encoder model loaded successfully")
        except Exception as e:
            logger.error(f"[RERANKER] Failed to load cross-encoder model: {e}", exc_info=True)
            raise
    return _model


async def rerank_chunks(query: str, chunks: List[dict], top_k: int = 5) -> List[dict]:
    try:
        model = get_reranker_model()
        
        if not chunks:
            return []
        
        pairs = [(query, chunk.get("content", "")) for chunk in chunks]
        
        scores = model.predict(pairs)
        
        chunk_scores = list(zip(chunks, scores))
        chunk_scores.sort(key=lambda x: x[1], reverse=True)
        
        return [chunk for chunk, score in chunk_scores[:top_k]]
    except Exception as e:
        logger.error(f"[RERANKER] Failed to rerank chunks: {e}", exc_info=True)
        return chunks[:top_k]