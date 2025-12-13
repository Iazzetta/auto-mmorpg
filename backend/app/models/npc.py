from enum import Enum
from pydantic import BaseModel
from typing import List, Dict, Optional

class NPCType(str, Enum):
    QUEST_GIVER = "quest_giver"
```python
from enum import Enum
from pydantic import BaseModel
from typing import List, Dict, Optional

class NPCType(str, Enum):
    QUEST_GIVER = "quest_giver"
    MERCHANT = "merchant"
    DIALOGUE = "dialogue"

class NPC(BaseModel):
    id: str
    name: str
    map_id: str
    x: float
    y: float
    type: NPCType
    icon: str = "👤"
    
    # Quest Giver Data
    quest_id: Optional[str] = None
    dialogue: Optional[List[str]] = None
    dialog_start: Optional[List[str]] = None
    dialog_accept: Optional[List[str]] = None
    dialog_reject: Optional[List[str]] = None
    
    # Merchant Data
    shop_items: Optional[List[str]] = None # List of Item IDs

```
