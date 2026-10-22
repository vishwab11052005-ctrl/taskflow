import json
import httpx
from app.config import settings


async def generate_json(system_prompt: str, user_prompt: str):
    url = settings.ollama_url.rstrip("/") + "/api/chat"
    payload = {
        "model": settings.ollama_model,
        "stream": False,
        "format": "json",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    }
    async with httpx.AsyncClient(timeout=90) as client:
        response = await client.post(url, json=payload)
        response.raise_for_status()
        content = response.json()["message"]["content"]
    return json.loads(content)
