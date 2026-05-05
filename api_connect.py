"""
Standalone OpenAI connectivity test.

Run this to verify your API key and connection work before running main.py.
Usage: python api_connect.py
"""

import os
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

response = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[{"role": "user", "content": "Schreibe ein Haiku über Automatisierung."}],
)

print(response.choices[0].message.content)
