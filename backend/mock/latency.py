import asyncio
import random


async def simulate_latency(min_ms: int = 800, max_ms: int = 1500) -> None:
    delay_ms = min_ms + random.random() * (max_ms - min_ms)
    await asyncio.sleep(delay_ms / 1000)
