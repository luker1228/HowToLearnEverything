import json
import os
from enum import Enum

from dotenv import load_dotenv
from openai import OpenAI
from pydantic import BaseModel


class EventName(str, Enum):
    science_fair = "Science Fair"
    team_meeting = "Team Meeting"
    birthday_party = "Birthday Party"


class CalendarEvent(BaseModel):
    name: EventName
    date: str
    participants: list[str]


def main() -> None:
    load_dotenv()
    client = OpenAI(
        api_key=os.getenv("OPENAI_API_KEY"),
        base_url=os.getenv("OPENAI_BASE_URL", "https://api.deepseek.com"),
    )

    response = client.chat.completions.create(
        model=os.getenv("OPENAI_MODEL", "deepseek-v4-pro"),
        messages=[
            {
                "role": "system",
                "content": "Return one JSON object with keys name, date, participants.",
            },
            {
                "role": "user",
                "content": "Alice and Bob are going to a science fair on Friday.",
            },
        ],
        # The hard constraint is the JSON response format plus local Pydantic validation.
        response_format={"type": "json_object"},
    )

    content = response.choices[0].message.content
    if not content:
        raise RuntimeError("DeepSeek returned empty content")

    event = CalendarEvent.model_validate(json.loads(content))
    print("Parsed event:")
    print(event.model_dump_json(indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
