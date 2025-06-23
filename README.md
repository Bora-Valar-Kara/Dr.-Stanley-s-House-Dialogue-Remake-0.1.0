# Dr. Stanley's House Dialogue Remake (Alpha)

Welcome to **Dr. Stanley's House Dialogue Remake**!  
The visual, narrative, audio, and music elements of this game were adapted from the legendary game *Dr. Stanley’s House*, a freely available Flash-based puzzle game created by James Li (2005), in which players assume the role of a detective solving a mystery through interaction with the environment.  

Similar to the original game, progress is controlled through conditional access to different “states” or rooms, which depend on the accumulation of specific items or information throughout the game. In our adaptation, however, the primary mode of interaction is **voice** rather than mouse or keyboard input.

---

## Frameworks

This game is built using the following technologies:

- **TypeScript** – Main programming language of the game.
- **XState 5.0** – Orchestrates the game’s state machine and manages logic and transitions.
- **SpeechState 2.0** – Handles voice recognition and text-to-speech, enabling voice-controlled gameplay.
- **Vite & Yarn** – Provide the development environment and dependency management.
- **Azure Cognitive Services** – Powers the speech functionalities of SpeechState (speech-to-text and text-to-speech).
- **Stately Inspector** – Visualizes the state machine and aids in debugging.
- **HTML/CSS** – For page structure and styling.
- **SSML (Speech Synthesis Markup Language)** – Allows advanced customization and control over the TTS output.
- **Azure NLU (Natural Language Understanding)** – Enables understanding of user input and extracts intent and key information from speech/text.

---

## Setup Instructions

### Option 1: Play the Pre-Deployed Game

Access the hosted version of the game:

🔗 [https://eduserv.flov.gu.se:9000/guskarabo](https://eduserv.flov.gu.se:9000/guskarabo)

Sign in with:

- **Username**: `webdevX`  
- **Password**: `pnfMfEETytSo`

---

### Option 2: Run Locally (⚠️ Currently Not Valid – Will Be Updated)

To set up the game on your local machine, you need to create a file named **azure.ts** in the directory **Dr_Stanleys_House_Dialogue_Remake_0.1.0/Code/src** after cloning the repository and downloading yarn dependencies in the **/Code** directory::

```bash
git clone https://github.com/Bora-Valar-Kara/Dr_Stanleys_House_Dialogue_Remake_0.1.0
cd Dr_Stanleys_House_Dialogue_Remake_0.1.0/Code
npm install
yarn
cd src
touch azure.ts
```
In azure.ts, add your Azure credentials with this syntax:

```typescript
export const KEY = "your_key";
    
export const NLU_KEY = "your_key";
```

You will need an Azure account to generate these keys. The guide to obtain them will be added soon.

## How to Play

Ideally, refresh the page before each gameplay and wait for a few seconds. Then press the button below that says "idle" to start the game, during the game, this button will change between "recognizing" and "speaking", the system will stop listening to you when it says: "speaking", only speak when it says "recognizing". Follow the instructions of the game and you can see hints about what you can say in each environmenton top left and top right of the screen. In the beginning, when your assistant says: "Please introduce yourself." Please say your detective name: "My name is ...", "I am ...", along with a short introduction about yourself. Fasten your seatbelts and enjoy the game! You can say similar phrases to the hints that are presented in the screen, for example, you can say, "I want to go right." "Let's go right.", "Maybe we can explore around the door." etc. 

## Future development
This game is a demo for a future expansion.

