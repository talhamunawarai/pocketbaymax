# VS Code mein PocketBaymax chalane ki guide (Roman Urdu)

## 1. Ek baar ki tayyari
1. **Node.js** install karein (version 18 ya naya): https://nodejs.org (LTS wala). Check karne ke liye terminal mein `node -v` likhein.
2. **VS Code** install karein: https://code.visualstudio.com
3. Is zip ko kisi folder mein **Extract** karein (e.g. `Desktop/pocketbaymax`).

## 2. AI chunein (koi ek)

### Option A: Free aur local (Ollama), koi key nahi chahiye
1. https://ollama.com se Ollama install karein aur chalu rakhein.
2. Terminal mein ye ek baar chalayein (lagbhag 3 GB download):
   `ollama pull gemma3:4b`
3. Agar computer mein 16 GB RAM ya zyada hai to behtar: `ollama pull gemma3:12b`, phir `.env` mein `OLLAMA_MODEL=gemma3:12b` likhein.

### Option B: Claude API (sabse behtar quality, paid)
1. https://console.anthropic.com se API key banayein.
2. `.env` file mein ye likhein:
   ```
   PROVIDER=anthropic
   ANTHROPIC_API_KEY=apni-key-yahan
   ```

## 3. VS Code mein kholna aur chalana
1. VS Code > **File > Open Folder** > `pocketbaymax` folder chunein.
2. Folder mein `.env.example` ki copy banayein aur naam rakhein `.env` (Option A ke liye andar kuch badalna nahi parta).
3. Terminal kholein (**Ctrl + `**) aur likhein:
   ```
   npm start
   ```
4. Terminal mein "Ollama: running" (ya "Claude API (key found)") likha aana chahiye.
5. Browser mein kholein: **http://localhost:3000**
6. Left menu mein **Stress** par jayein, photo upload karein, aur result dekhein.

Band karne ke liye terminal mein **Ctrl + C**.

## 4. Mushkilat ka hal
| Masla | Hal |
|---|---|
| "Claude isn't available" ka peela banner | Ollama chalu nahi hai ya model download nahi hua. Terminal ka message dekhein, `ollama pull gemma3:4b` chalayein, phir `npm start` dobara. |
| Stress scan "Please try again" deta hai | Chhota model JSON theek nahi bhejta. `gemma3:12b` ya Claude API use karein. |
| Photo read nahi hoti (iPhone HEIC) | JPG ya PNG use karein. Phone ki setting mein "Most Compatible" format chunein. |
| `npm` command nahi mila | Node.js dobara install karein aur VS Code band karke dobara kholein. |
| Port 3000 pehle se use mein hai | `.env` mein `PORT=3001` likhein aur http://localhost:3001 kholein. |
| Selfie button laptop par | Laptop par ye sirf file chooser kholta hai. Asli camera phone par chalta hai. |

## 5. Phone se test karna
Server sirf aapke computer (localhost) par chalta hai taake API key mehfooz rahe. Phone par dekhne ke liye sabse aasan hai VS Code ka **Live Server** nahi, balki browser ka mobile mode: Chrome mein **F12 > Ctrl+Shift+M**.

## 6. Zaroori yaad-dehani
- Ye prototype hai: tamam doctors, clinics aur slots farzi hain.
- Stress scan chehre se sirf ek rough andaza hai, medical test ya diagnosis nahi.
- `.env` ko kabhi GitHub par upload na karein (`.gitignore` mein pehle se shamil hai).
