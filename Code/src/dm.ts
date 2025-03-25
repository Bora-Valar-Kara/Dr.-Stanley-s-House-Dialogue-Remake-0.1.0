import { assign, createActor, setup } from "xstate";
import { Settings, speechstate } from "speechstate";
import { createBrowserInspector } from "@statelyai/inspect";
import { KEY, NLU_KEY } from "./azure";
import { DMContext, DMEvents} from "./types";

import * as sdk from "microsoft-cognitiveservices-speech-sdk";

const speechConfig = sdk.SpeechConfig.fromSubscription(KEY, "northeurope");
speechConfig.speechSynthesisVoiceName = "en-US-TonyNeural";

export function speakSSML(ssml: string) {
  const synthesizer = new sdk.SpeechSynthesizer(speechConfig);
  synthesizer.speakSsmlAsync(
    ssml,
    (result) => {
      if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
        console.log("Speech synthesis succeeded.");
      } else {
        console.error("Speech synthesis failed:", result.errorDetails);
      }
      synthesizer.close();
    },
    (error) => {
      console.error("Speech synthesis error:", error);
      synthesizer.close();
    }
  );
}

function getNonPickupObject(context: DMContext): string | null {
  if (context.interpretation) {
    for (const entity of context.interpretation.entities) {
      if (entity.category === "NonPickupObject") {
        return entity.text.toLowerCase(); 
      }
    }
  }
  return null;
}

function getDoorColor(context: DMContext): string | null {
  if (context.interpretation) {
    for (const entity of context.interpretation.entities) {
      if (entity.category === "DoorColor") {
        return entity.text.toLowerCase();
      }
    }
  }
  return null;
}

function getDirection(context: DMContext): string | null {
  if (context.interpretation) {
    for (const entity of context.interpretation.entities) {
      if (entity.category === "Direction") {
        return entity.text.toLowerCase();
      }
    }
  }
  return null;
}

function getUsableObject(context: DMContext): string | null {
  if (context.interpretation) {
    for (const entity of context.interpretation.entities) {
      if (entity.category === "UsableObject") {
        return entity.text.toLowerCase();
      }
    }
  }
  return null;
}

function stopAllMedia() {
  const videoElement = document.getElementById("state-video") as HTMLVideoElement;
  const audioElement = document.getElementById("state-sound") as HTMLAudioElement;
  
  if (videoElement) {
    videoElement.pause();
    videoElement.currentTime = 0;
    videoElement.removeAttribute('src');
    videoElement.load();
  }
  
  if (audioElement) {
    audioElement.pause();
    audioElement.currentTime = 0;
    audioElement.removeAttribute('src');
    audioElement.load();
  }
}

function getPlayerName(context: DMContext): string {
  if (context.interpretation) {
    for (const entity of context.interpretation.entities) {
      if (entity.category === "PersonName") {
        return entity.text;
      }
    }
  }
  return "";
}

const inspector = createBrowserInspector();

const azureCredentials = {
  endpoint:
    "https://northeurope.api.cognitive.microsoft.com/sts/v1.0/issuetoken",
  key: KEY,
};

const azureLanguageCredentials = {
    endpoint: "https://talhanlu.cognitiveservices.azure.com/language/:analyze-conversations?api-version=2024-11-15-preview" /** your Azure CLU prediction URL */,
    key: NLU_KEY /** reference to your Azure CLU key */,
    deploymentName: "HorrorGameDeployment" /** your Azure CLU deployment */,
    projectName: "HorrorGame" /** your Azure CLU project name */,
  };

const settings: Settings = {
    azureLanguageCredentials: azureLanguageCredentials /** global activation of NLU */,
    azureCredentials: azureCredentials,
    azureRegion: "northeurope",
    asrDefaultCompleteTimeout: 0,
    asrDefaultNoInputTimeout: 15000,
    locale: "en-US",
    ttsDefaultVoice: "en-US-ShimmerTurboMultilingualNeural",
  };

const dmMachine = setup({
  types: {
    context: {} as DMContext,
    events: {} as DMEvents,
  },
  actions: {
    stopAllMedia,

    "spst.speak": ({ context }, params: { utterance: string }) =>
      context.spstRef.send({
        type: "SPEAK",
        value: {
          utterance: params.utterance,
        },
      }),

    "spst.listen": ({ context }) =>
      context.spstRef.send({
        type: "LISTEN",
        value: { nlu: true }
      }),

    playSound: ({}, params: { soundUrl: string, loop: boolean }) => {
      const audioElement = document.getElementById("state-sound") as HTMLAudioElement;
      if (audioElement) {
        audioElement.src = params.soundUrl;  // Set sound URL
        audioElement.loop = params.loop;     // Set loop behavior
        audioElement.play();                 // Play the sound
      }
    },

    "azure.speakSSML": ({ self }, params: { ssml: string }) => {
  const synthesizer = new sdk.SpeechSynthesizer(speechConfig);
  synthesizer.speakSsmlAsync(
    params.ssml,
    (result) => {
      if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
        console.log("Speech synthesis succeeded.");
        self.send({ type: "SPEAK_COMPLETE" }); // Send SPEAK_COMPLETE event
      } else {
        console.error("Speech synthesis failed:", result.errorDetails);
      }
      synthesizer.close();
    },
    (error) => {
      console.error("Speech synthesis error:", error);
      synthesizer.close();

    }
  );
},

    stopSound: () => {
      const audioElement = document.getElementById("state-sound") as HTMLAudioElement;
      if (audioElement) {
        audioElement.pause();  // Stop the audio
        audioElement.currentTime = 0;  // Reset to the start
        
      }
    },

    stopVideo: () => {
      const videoElement = document.getElementById("state-video") as HTMLVideoElement;
      if (videoElement) {
        videoElement.pause(); // Stop the video
        videoElement.currentTime = 0; // Reset to the start
        videoElement.style.display = "none"; // Optionally hide the video element
      }
    },
    
  },
}).createMachine({
  context: ({ spawn }) => ({
    spstRef: spawn(speechstate, { input: settings }),
    lastResult: null,
    items: null,
    imageUrl: "",
    videoUrl: "",
    soundUrl: "",
    loop: null,
    Inventory: ["your notepad", "your pen"],
    PlayerName: "",
    interpretation: null,
    confirm: false,
  }),
  id: "DM",
  initial: "Prepare",
  states: {

    Prepare: {
      entry: ({ context }) => context.spstRef.send({ type: "PREPARE" }),
      on: { ASRTTS_READY: "WaitToStart" },
    },
    
    WaitToStart: {
      entry: [
        assign({
          imageUrl: "https://github.com/Bora-Valar-Kara/dialogue-systems-1-2025/blob/main/edited1.png?raw=true", // Image for this state
        }),
        { type: "playSound", params: { soundUrl: "https://github.com/Bora-Valar-Kara/dialogue-systems-1-2025/raw/refs/heads/main/intro.mp3", loop: false } },
      ],
      on: { CLICK: "#DM.AskPlayerName" },
    },

    AskPlayerName: { // NLU entegre edilecek state geçiş intent ve entitiy için
      initial: "Prompt",
      on: {
        LISTEN_COMPLETE: [
          {
            target: "NameConfirm",
            guard: ({ context }) => !!context.PlayerName,
          },
          { target: ".Ask" },
        ],
      },
      states: {
        Prompt: {
          entry: { 
              type: "azure.speakSSML", 
              params: { ssml: `<!--ID=B7267351-473F-409D-9765-754A8EBCDE05;Version=1|{"VoiceNameToIdMapItems":[{"Id":"e5e4f59b-65c6-42b2-a6e3-5985d1a1ea07","Name":"Microsoft Server Speech Text to Speech Voice (en-US, JennyNeural)","ShortName":"en-US-JennyNeural","Locale":"en-US","VoiceType":"StandardVoice"}]}-->
<!--ID=FCB40C2B-1F9F-4C26-B1A1-CF8E67BE07D1;Version=1|{"Files":{}}-->
<!--ID=5B95B1CC-2C7B-494F-B746-CF22A0E779B7;Version=1|{"Locales":{"en-US":{"AutoApplyCustomLexiconFiles":[{}]}}}-->
<speak xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="http://www.w3.org/2001/mstts" xmlns:emo="http://www.w3.org/2009/10/emotionml" version="1.0" xml:lang="en-US"><mstts:backgroundaudio src="https://raw.githubusercontent.com/Bora-Valar-Kara/dialogue-systems-1-2025/refs/heads/main/radio.mp3" volume="2.0" /><voice name="en-US-JennyNeural"><mstts:express-as style="whispering"> Greetings Detective. I will be your guide in this investigation. Please introduce yourself.</mstts:express-as></voice></speak>` } 
            },
          on: { SPEAK_COMPLETE: "Ask" },
        },
        NoInput: {
          entry: {
            type: "spst.speak",
            params: { utterance: `` },
          },
          on: { SPEAK_COMPLETE: "Ask" },
        },

        Ask: {
          entry: { type: "spst.listen" },
          on: {
            RECOGNISED: {
              actions: assign(({ context, event }) => {
                //  if (context.interpretation?.topIntent === "NameCapture") {
                    return {
                      PlayerName: getPlayerName(context),
                      interpretation: event.nluValue,
                      lastResult: event.value
                    };
                /*  } else {
                    return {
                      PlayerName: event.value[0]?.utterance || "",
                      lastResult: event.value,
                    };
                  } */
              }),
            },
            ASR_NOINPUT: {
              actions: assign({ lastResult: null }),
            },
          },
        },
      },
    },

    NameConfirm: { // silinebilir
      initial: "Prompt",
      on: {
        LISTEN_COMPLETE: [
          {
            target: "FirstEntrance",
            guard: ({ context }) => context.interpretation?.topIntent === "MoveToX", // NLU confirmation
          },
          { target: "#DM.NameConfirm.Ask" },
        ],
      },
      states: {
        Prompt: {
          entry: [
            assign({
              imageUrl: "https://github.com/Bora-Valar-Kara/dialogue-systems-1-2025/blob/main/edited2.png?raw=true",
            }),
            { type: "playSound", params: { soundUrl: "https://github.com/Bora-Valar-Kara/dialogue-systems-1-2025/raw/refs/heads/main/letter.mp3", loop: true } },
            {
              type: "azure.speakSSML",
              params: ({ context }) => ({
              ssml: `<!--ID=B7267351-473F-409D-9765-754A8EBCDE05;Version=1|{"VoiceNameToIdMapItems":[{"Id":"96d631b1-d438-48ba-aa46-6293707d2071","Name":"Microsoft Server Speech Text to Speech Voice (en-US, TonyNeural)","ShortName":"en-US-TonyNeural","Locale":"en-US","VoiceType":"StandardVoice"}]}-->
  <!--ID=FCB40C2B-1F9F-4C26-B1A1-CF8E67BE07D1;Version=1|{"Files":{}}-->
  <!--ID=5B95B1CC-2C7B-494F-B746-CF22A0E779B7;Version=1|{"Locales":{"en-US":{"AutoApplyCustomLexiconFiles":[{}]}}}-->
  <speak xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="http://www.w3.org/2001/mstts" xmlns:emo="http://www.w3.org/2009/10/emotionml" version="1.0" xml:lang="en-US"><voice name="en-US-TonyNeural"><s /><mstts:express-as style="whispering">Detective ${context.PlayerName}, I am Dr. Stanley from XXX Research and Development Center. Could you please come to my house for a visit? I have something very urgent! Thanks! Stanley.</mstts:express-as><s /></voice></speak>`,
              }),
              
            },
          ],
          on: { SPEAK_COMPLETE: "#DM.NameConfirm.Ask" },
        },
        NoInput: {
          entry: {
            type: "spst.speak",
            params: { utterance: `` },
          },
          on: { SPEAK_COMPLETE: "#DM.NameConfirm.Ask" },
        },
        Ask: {
          entry: { type: "spst.listen" },
          on: {
            RECOGNISED: {
              actions: assign(({ event }) => {
                return { lastResult: event.value, interpretation: event.nluValue };
              }),
            },
            ASR_NOINPUT: {
              actions: assign({ lastResult: null }),
            },
          },
        },
      },
    },

    FirstEntrance: {
      initial: "FirstEntrancePrompt",
      on: {        
        LISTEN_COMPLETE: [
        {
          target: "Approached_Car", 
          guard: ({ context }) => 
          context.interpretation?.topIntent === "ApproachX" &&
          getNonPickupObject(context) === "car" &&
          !(context.Inventory.includes("a brown stick")),
        },

        {
          target: "Approached_Car_NoItem", 
          guard: ({ context }) => 
          context.interpretation?.topIntent === "ApproachX" &&
          getNonPickupObject(context) === "car" &&
          context.Inventory.includes("a brown stick"),
        },

        { target: "Approached_FrontDoor", 
          guard: ({ context }) => 
          context.interpretation?.topIntent === "ApproachX" &&
          getNonPickupObject(context) === "door",
        },

        { target: ".ExploreAround",
          guard: ({ context }) => 
          context.interpretation?.topIntent === "ExploreAround",
        },

        { target: ".ContextualHelp",
          guard: ({ context }) => 
          context.interpretation?.topIntent === "AskContextualHelp",
        },

        { target: ".ExamineInventory",
          guard: ({ context }) =>
          context.interpretation?.topIntent === "ExamineInventory",
        },

        {
          target: "#DM.Backyard", 
          guard: ({ context }) => 
          context.interpretation?.topIntent === "MoveToX" &&
          getDirection(context) === "right" &&
          !context.Inventory.includes("paper with the code 295233"),
        },

        {
          target: "#DM.BackyardNoItem", 
          guard: ({ context }) => 
          context.interpretation?.topIntent === "MoveToX" &&
          getDirection(context) === "right" &&
          context.Inventory.includes("paper with the code 295233"),
        },

        { target: ".FirstEntranceAsk" }, 
      ],
      },
      states: {
        FirstEntrancePrompt: {
          entry: [
            assign({
              imageUrl: "https://github.com/Bora-Valar-Kara/dialogue-systems-1-2025/blob/main/edited3.png?raw=true",
            }),
            { type: "playSound", params: { soundUrl: "https://github.com/Bora-Valar-Kara/dialogue-systems-1-2025/raw/refs/heads/main/theme.mp3", loop: true } },
            { 
              type: "azure.speakSSML", 
              params: { ssml: `<!--ID=B7267351-473F-409D-9765-754A8EBCDE05;Version=1|{"VoiceNameToIdMapItems":[{"Id":"b5f86142-ce84-4483-8142-45db0d778add","Name":"Microsoft Server Speech Text to Speech Voice (en-US, DavisNeural)","ShortName":"en-US-DavisNeural","Locale":"en-US","VoiceType":"StandardVoice"}]}-->
<!--ID=FCB40C2B-1F9F-4C26-B1A1-CF8E67BE07D1;Version=1|{"Files":{}}-->
<!--ID=5B95B1CC-2C7B-494F-B746-CF22A0E779B7;Version=1|{"Locales":{"en-US":{"AutoApplyCustomLexiconFiles":[{}]}}}-->
<speak xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="http://www.w3.org/2001/mstts" xmlns:emo="http://www.w3.org/2009/10/emotionml" version="1.0" xml:lang="en-US"><voice name="en-US-DavisNeural"><s /><mstts:express-as style="whispering">I have arrived at Dr. Stanley's house. A call breeze washes over my face... And I can't help but the feeling that I am being watched!</mstts:express-as><s /></voice></speak>` } 
            },
          ],
          on: { SPEAK_COMPLETE: "FirstEntranceAsk" },
        },

        NoInput: {
          entry: [
            { type: "spst.speak", params: { utterance: `` } },
            assign({
              imageUrl: "https://github.com/Bora-Valar-Kara/dialogue-systems-1-2025/blob/main/edited3.png?raw=true",
            }),
          ],
          on: { SPEAK_COMPLETE: "FirstEntranceAsk" },
        },

        FirstEntranceAsk: {
          entry: { type: "spst.listen" },
          on: {
            RECOGNISED: {
              actions: assign(({ event }) => {
                return { 
                  lastResult: event.value, 
                  interpretation: event.nluValue 
                }; 
              }),
            },
            ASR_NOINPUT: {
              actions: assign({ lastResult: null }),
            },
          },
        },

        // ExploreAround state gives more information about the surrounding area and gives important clues to the player.
        ExploreAround: {
          entry: { type: "spst.speak", params: {utterance: `You meticulously explore around to detect suspicious items and clues. It looks like that car is worth investigating and the door requires an entrance code.` } },
          on: { SPEAK_COMPLETE: "NoInput" },
        },

        // ExamineInventory state simply lists the items in the player's inventory.
        ExamineInventory: {
          entry: { type: "spst.speak", params: ({ context }) => ({ utterance: `You have the following items in your inventory: ${context.Inventory.join(", ")}` }) }, // by using join(", ") we can separate the items with a comma so we can read them here.
          on: { SPEAK_COMPLETE: "NoInput" },
        },
        
        // ContextualHelp state gives the player information about the possible actions they can take.
        ContextualHelp: {
          entry: { type: "spst.speak", params: { utterance: `You can say "approach car" to approach car. You can also approach the door or go right. You can additionally examine your inventory or ask to explore around!` } },
          on: { SPEAK_COMPLETE: "NoInput" },
        },
      },
    },
    
    Approached_Car: { // 1-Explore Around 2- Examine Inventory 3- Ask for help 4- Go Back 5- Take the item 
      initial: "Approached_CarPrompt",
      on: {        
        LISTEN_COMPLETE: [

        { target: "FirstEntrance.NoInput", 
          guard: ({ context }) => 
          context.interpretation?.topIntent === "MoveToX" && // if the player says "previous" or "back" as direction, we can send them back to the FirstEntrance state.
          getDirection(context) === "back" || getDirection(context) === "previous",
        },

        { target: ".TakeTheStick", // This state will pick up the stick and add it to the player's inventory.
          guard: ({ context }) => 
          context.interpretation?.topIntent === "TakeTheStick",
        },

        { target: ".ExploreAround",
          guard: ({ context }) => 
          context.interpretation?.topIntent === "ExploreAround",
        },

        { target: ".ExamineInventory",
          guard: ({ context }) =>
          context.interpretation?.topIntent === "ExamineInventory",
        },

        { target: ".ContextualHelp",
          guard: ({ context }) => 
          context.interpretation?.topIntent === "AskContextualHelp",
        },

        { target: ".NoInput" }, 
      ],
      },
      states: {
        Approached_CarPrompt: {
          entry: [
            assign({
              imageUrl: "https://github.com/Bora-Valar-Kara/dialogue-systems-1-2025/blob/main/edited4.png?raw=true",
            }),
            { 
              type: "azure.speakSSML", 
              params: { ssml: `<!--ID=B7267351-473F-409D-9765-754A8EBCDE05;Version=1|{"VoiceNameToIdMapItems":[{"Id":"b5f86142-ce84-4483-8142-45db0d778add","Name":"Microsoft Server Speech Text to Speech Voice (en-US, DavisNeural)","ShortName":"en-US-DavisNeural","Locale":"en-US","VoiceType":"StandardVoice"}]}-->
<!--ID=FCB40C2B-1F9F-4C26-B1A1-CF8E67BE07D1;Version=1|{"Files":{}}-->
<!--ID=5B95B1CC-2C7B-494F-B746-CF22A0E779B7;Version=1|{"Locales":{"en-US":{"AutoApplyCustomLexiconFiles":[{}]}}}-->
<speak xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="http://www.w3.org/2001/mstts" xmlns:emo="http://www.w3.org/2009/10/emotionml" version="1.0" xml:lang="en-US"><voice name="en-US-DavisNeural"><s /><mstts:express-as style="whispering" styledegree="0.7">I approached the car. It seems like there is important stuff around it.</mstts:express-as><s /></voice></speak>` } 
            },
          ],
          on: { SPEAK_COMPLETE: "Approached_CarAsk" },
        },

        NoInput: {
          entry: { type: "spst.speak", params: { utterance: `` } },
          on: { SPEAK_COMPLETE: "Approached_CarAsk" },
        },

        Approached_CarAsk: {
          entry: { type: "spst.listen" },
          on: {
            RECOGNISED: {
              actions: assign(({ event }) => {
                return { 
                  lastResult: event.value, 
                  interpretation: event.nluValue 
                }; 
              }),
            },
            ASR_NOINPUT: {
              actions: assign({ lastResult: null }),
            },
          },
        },

        // TakeTheStick state will add the stick to the player's inventory.
        TakeTheStick: {
          entry: [
            assign(({ context }) => ({
              Inventory: [...context.Inventory, "a brown stick"],
            })),
            { type: "spst.speak", params: { utterance: `You take the stick with you. It looks like a long, sturdy stick. It might be useful for reaching higher places you can't reach on your own. ` } },
            assign({
              imageUrl: "https://github.com/Bora-Valar-Kara/dialogue-systems-1-2025/blob/main/edited5.png?raw=true",
            }),
          ],
          on: { SPEAK_COMPLETE: "#DM.FirstEntrance.NoInput" },
        },

        // ExploreAround state gives more information about the surrounding area and gives important clues to the player.
        ExploreAround: {
          entry: { type: "spst.speak", params: {utterance: `It looks like a German car from nineties. Not entirely practical to have in this day and age. Like a sign of an interest rather than poverty. Oh... And it looks like there is a brown stick next to the car.` } },
          on: { SPEAK_COMPLETE: "NoInput" },
        },

        // ExamineInventory state simply lists the items in the player's inventory.
        ExamineInventory: {
          entry: { type: "spst.speak", params: ({ context }) => ({ utterance: `You have the following items in your inventory: ${context.Inventory.join(", ")}` }) }, // by using join(", ") we can separate the items with a comma so we can read them here.
          on: { SPEAK_COMPLETE: "NoInput" },
        },

        // ContextualHelp state gives the player information about the possible actions they can take.
        ContextualHelp: {
          entry: { type: "spst.speak", params: { utterance: `You can take the items by saying it, or you can go back to the entrance by saying something like "go back" or "go to the previous state". You can additionally examine your inventory or ask to explore around!` } },
          on: { SPEAK_COMPLETE: "NoInput" },
        },
        
      },
    },
    
    Approached_Car_NoItem: { // 1-Explore Around 2- Examine Inventory 3- Ask for help 4- Go Back
      initial: "Approached_Car_NoItemPrompt",
      on: {        
        LISTEN_COMPLETE: [

        { target: "#DM.FirstEntrance.NoInput", 
          guard: ({ context }) => 
          context.interpretation?.topIntent === "MoveToX" && // if the player says "previous" or "back" as direction, we can send them back to the FirstEntrance state.
          getDirection(context) === "back" || getDirection(context) === "previous",
        },


        { target: ".ExploreAround",
          guard: ({ context }) => 
          context.interpretation?.topIntent === "ExploreAround",
        },

        { target: ".ExamineInventory",
          guard: ({ context }) =>
          context.interpretation?.topIntent === "ExamineInventory",
        },

        { target: ".ContextualHelp",
          guard: ({ context }) => 
          context.interpretation?.topIntent === "AskContextualHelp",
        },

        { target: ".NoInput" }, 
      ],
      },
      states: {
        Approached_Car_NoItemPrompt: {
          entry: [
            assign({
              imageUrl: "https://github.com/Bora-Valar-Kara/dialogue-systems-1-2025/blob/main/edited5.png?raw=true",
            }),
            { type: "azure.speakSSML", params: { ssml: `<!--ID=B7267351-473F-409D-9765-754A8EBCDE05;Version=1|{"VoiceNameToIdMapItems":[{"Id":"b5f86142-ce84-4483-8142-45db0d778add","Name":"Microsoft Server Speech Text to Speech Voice (en-US, DavisNeural)","ShortName":"en-US-DavisNeural","Locale":"en-US","VoiceType":"StandardVoice"}]}-->
<!--ID=FCB40C2B-1F9F-4C26-B1A1-CF8E67BE07D1;Version=1|{"Files":{}}-->
<!--ID=5B95B1CC-2C7B-494F-B746-CF22A0E779B7;Version=1|{"Locales":{"en-US":{"AutoApplyCustomLexiconFiles":[{}]}}}-->
<speak xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="http://www.w3.org/2001/mstts" xmlns:emo="http://www.w3.org/2009/10/emotionml" version="1.0" xml:lang="en-US"><voice name="en-US-DavisNeural"><mstts:express-as style="whispering" styledegree="0.7">It seems I have done everything I can do here.</mstts:express-as></voice></speak>` } },
          ],
          on: { SPEAK_COMPLETE: "Approached_Car_NoItemAsk" },
        },

        NoInput: {
          entry: { type: "spst.speak", params: { utterance: `` } },
          on: { SPEAK_COMPLETE: "Approached_Car_NoItemAsk" },
        },

        Approached_Car_NoItemAsk: {
          entry: { type: "spst.listen" },
          on: {
            RECOGNISED: {
              actions: assign(({ event }) => {
                return { 
                  lastResult: event.value, 
                  interpretation: event.nluValue 
                }; 
              }),
            },
            ASR_NOINPUT: {
              actions: assign({ lastResult: null }),
            },
          },
        },

        // ExploreAround state gives more information about the surrounding area and gives important clues to the player.
        ExploreAround: {
          entry: { type: "spst.speak", params: {utterance: `It looks like a German car from nineties. Not entirely practical to have in this day and age. Like a sign of an interest rather than poverty. There is nothing left to do here.` } },
          on: { SPEAK_COMPLETE: "NoInput" },
        },

        // ExamineInventory state simply lists the items in the player's inventory.
        ExamineInventory: {
          entry: { type: "spst.speak", params: ({ context }) => ({ utterance: `You have the following items in your inventory: ${context.Inventory.join(", ")}` }) }, // by using join(", ") we can separate the items with a comma so we can read them here.
          on: { SPEAK_COMPLETE: "NoInput" },
        },

        // ContextualHelp state gives the player information about the possible actions they can take.
        ContextualHelp: {
          entry: { type: "spst.speak", params: { utterance: `You can go back to the entrance by saying something like "go back" or "go to the previous state". You can additionally examine your inventory or ask to explore around!` } },
          on: { SPEAK_COMPLETE: "NoInput" },
        },
        
      },
    },

    Approached_FrontDoor: { // 1-Explore Around 2- Examine Inventory 3- Ask for help 4- Enter the password 5- Go back
      initial: "Approached_FrontDoorPrompt",
      on: {        
        LISTEN_COMPLETE: [

        { target: "TryPasswordRequest", // When the speaker says something like "I would like to try password" or "enter password" the game will move to the TryPasswordRequest state.
          guard: ({ context }) =>
          context.interpretation?.topIntent === "TryPasswordRequest",
        },

        { target: "FirstEntrance.NoInput", 
          guard: ({ context }) => 
          context.interpretation?.topIntent === "MoveToX" &&
          getDirection(context) === "back" || getDirection(context) === "previous", // if the player wants to go back to the previous state, we can send them back to the FirstEntrance state.
        },

        { target: ".ExploreAround",
          guard: ({ context }) => 
          context.interpretation?.topIntent === "ExploreAround",
        },

        { target: ".ExamineInventory",
          guard: ({ context }) =>
          context.interpretation?.topIntent === "ExamineInventory",
        },

        { target: ".ContextualHelp",
          guard: ({ context }) => 
          context.interpretation?.topIntent === "AskContextualHelp",
        },

        { target: ".NoInput" }, 
      ],
      },
      states: {
        Approached_FrontDoorPrompt: {
          entry: [{ type: "spst.speak", params: { utterance: `It might be a good idea to observe around the door.` } },
            assign({
              imageUrl: "https://github.com/Bora-Valar-Kara/dialogue-systems-1-2025/blob/main/edited10.png?raw=true",
            }),
          ],
          on: { SPEAK_COMPLETE: "Approached_FrontDoorAsk" },
        },

        NoInput: {
          entry: { type: "spst.speak", params: { utterance: `` } },
          on: { SPEAK_COMPLETE: "Approached_FrontDoorAsk" },
        },

        Approached_FrontDoorAsk: {
          entry: { type: "spst.listen" },
          on: {
            RECOGNISED: {
              actions: assign(({ event }) => {
                return { 
                  lastResult: event.value, 
                  interpretation: event.nluValue 
                }; 
              }),
            },
            ASR_NOINPUT: {
              actions: assign({ lastResult: null }),
            },
          },
        },

        // ExploreAround state gives more information about the surrounding area and gives important clues to the player.
        ExploreAround: {
          entry: { type: "spst.speak", params: {utterance: `It seems like the door is locked by an entrance code... Hmm... It looks like a 6-digit code.` } },
          on: { SPEAK_COMPLETE: "NoInput" },
        },

        // ExamineInventory state simply lists the items in the player's inventory.
        ExamineInventory: {
          entry: { type: "spst.speak", params: ({ context }) => ({ utterance: `You have the following items in your inventory: ${context.Inventory.join(", ")}` }) }, // by using join(", ") we can separate the items with a comma so we can read them here.
          on: { SPEAK_COMPLETE: "NoInput" },
        },

        // ContextualHelp state gives the player information about the possible actions they can take.
        ContextualHelp: {
          entry: { type: "spst.speak", params: { utterance: `You can try to enter 4-digit password by saying something like "Enter the password!", or you can go back to the entrance by saying something like "go back" or "go to the previous state". You can additionally examine your inventory or ask to explore around!` } },
          on: { SPEAK_COMPLETE: "NoInput" },
        },  
      },
    },

    TryPasswordRequest: { // 1-Explore Around 2- Examine Inventory 3- Ask for help 4- Enter the password 5- Go back
      initial: "TryPasswordRequestPrompt",
      on: {        
        LISTEN_COMPLETE: [

        { target: "HouseEntrance", // Checks if the player's input is the correct password: 295233. If it is, the player will be able to enter the house. If the password is incorrect, transition to the WrongPassword state.
          guard: ({ context }) =>
          context.lastResult?.[0]?.utterance === "295233" || context.lastResult?.[0]?.utterance === "295 233" || context.lastResult?.[0]?.utterance === "two nine five two three three",
        },

        { target: "Approached_FrontDoor.NoInput", 
          guard: ({ context }) => 
          context.interpretation?.topIntent === "MoveToX" &&
          getDirection(context) === "back" || getDirection(context) === "previous", // if the player wants to go back to the previous state, we can send them back to the FirstEntrance state.
        },

        { target: ".ExamineInventory",
          guard: ({ context }) =>
          context.interpretation?.topIntent === "ExamineInventory",
        },

        { target: ".ContextualHelp",
          guard: ({ context }) => 
          context.interpretation?.topIntent === "AskContextualHelp",
        },

        { target: ".WrongPassword", // If the password is incorrect, the player will be informed and asked to try again.
          guard: ({ context }) =>
          context.lastResult?.[0]?.utterance !== "295233"
        },

        { target: ".NoInput" }, 
      ],
      },
      states: {
        TryPasswordRequestPrompt: {
          entry: { type: "spst.speak", params: { utterance: `Please say the password.` } },
          on: { SPEAK_COMPLETE: "TryPasswordRequestAsk" },
        },

        NoInput: {
          entry: { type: "spst.speak", params: { utterance: `Please say the password.` } },
          on: { SPEAK_COMPLETE: "TryPasswordRequestAsk" },
        },

        TryPasswordRequestAsk: {
          entry: { type: "spst.listen" },
          on: {
            RECOGNISED: {
              actions: assign(({ event }) => {
                return { 
                  lastResult: event.value,
                  interpretation: event.nluValue 
                }; 
              }),
            },
            ASR_NOINPUT: {
              actions: assign({ lastResult: null }),
            },
          },
        },

        // ExamineInventory state simply lists the items in the player's inventory.
        ExamineInventory: {
          entry: { type: "spst.speak", params: ({ context }) => ({ utterance: `You have the following items in your inventory: ${context.Inventory.join(", ")}` }) }, // by using join(", ") we can separate the items with a comma so we can read them here.
          on: { SPEAK_COMPLETE: "NoInput" },
        },

        // ContextualHelp state gives the player information about the possible actions they can take.
        ContextualHelp: {
          entry: { type: "spst.speak", params: { utterance: `You can try to enter 4-digit password by saying the numbers, or you can go back to the entrance by saying something like "go back" or "go to the previous state". You can additionally examine your inventory or ask to explore around!` } },
          on: { SPEAK_COMPLETE: "NoInput" },
        },  

        // If the password is wrong, the player will be informed and asked to try again.
        WrongPassword: {
          entry: { type: "spst.speak", params: { utterance: `The password is incorrect.` } },
          on: { SPEAK_COMPLETE: "TryPasswordRequestAsk" },
      },
    },
  },

  HouseEntrance: { // 1-Explore Around 2- Examine Inventory 3- Ask for help 4- Open the blue door 5- Open the yellow door 6- Go Right 7- Go back/Turn Back 
    initial: "HouseEntrancePrompt",
    on: {        
      LISTEN_COMPLETE: [
        
      { target: "FirstEntrance.NoInput", // If we say to go to previous state, we can send the player back to the FirstEntrance state.
        guard: ({ context }) => 
        context.interpretation?.topIntent === "MoveToX" &&
        getDirection(context) === "previous", 
      },
      
      { target: "FirstEntrance.NoInput", // Alternatively the door with the blue color will take the player back to the FirstEntrance state.
        guard: ({ context }) => 
        context.interpretation?.topIntent === "GoToDoorWithColorX" &&
        getDoorColor(context) === "blue",
      },

      { target: "YellowRoom", // The yellow door will take the player to the YellowRoom state. But only if we did not pick up the green key.
        guard: ({ context }) => 
        context.interpretation?.topIntent === "GoToDoorWithColorX" &&
        getDoorColor(context) === "yellow" &&
        !context.Inventory.includes("a green key"),
      },

      { target: "YellowRoomNoItem", // The yellow door will take the player to the YellowRoomNoItem state. But only if we picked up the green key.
        guard: ({ context }) => 
        context.interpretation?.topIntent === "GoToDoorWithColorX" &&
        getDoorColor(context) === "yellow" &&
        context.Inventory.includes("a green key"),
      },

      { target: "SecondEntranceInside", // The player can go to the SecondEntranceInside state by saying "go back".
        guard: ({ context }) => 
        context.interpretation?.topIntent === "MoveToX" &&
        getDirection(context) === "back",
      },

      { target: "Staircase", // The player can go to the StaircaseDownstairs state by saying "go right".
        guard: ({ context }) => 
        context.interpretation?.topIntent === "MoveToX" &&
        getDirection(context) === "right",
      },

      { target: ".ExploreAround", 
        guard: ({ context }) => 
        context.interpretation?.topIntent === "ExploreAround",
      },

      { target: ".ExamineInventory",
        guard: ({ context }) =>
        context.interpretation?.topIntent === "ExamineInventory",
      },

      { target: ".ContextualHelp",
        guard: ({ context }) => 
        context.interpretation?.topIntent === "AskContextualHelp",
      },

      { target: ".NoInput" },
    ],
    },
    states: {
      HouseEntrancePrompt: {
        entry: [
          {
            type: "azure.speakSSML",
            params: ({ context }) => ({
            ssml: `<!--ID=B7267351-473F-409D-9765-754A8EBCDE05;Version=1|{"VoiceNameToIdMapItems":[{"Id":"b5f86142-ce84-4483-8142-45db0d778add","Name":"Microsoft Server Speech Text to Speech Voice (en-US, DavisNeural)","ShortName":"en-US-DavisNeural","Locale":"en-US","VoiceType":"StandardVoice"}]}-->
<!--ID=FCB40C2B-1F9F-4C26-B1A1-CF8E67BE07D1;Version=1|{"Files":{}}-->
<!--ID=5B95B1CC-2C7B-494F-B746-CF22A0E779B7;Version=1|{"Locales":{"en-US":{"AutoApplyCustomLexiconFiles":[{}]}}}-->
<speak xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="http://www.w3.org/2001/mstts" xmlns:emo="http://www.w3.org/2009/10/emotionml" version="1.0" xml:lang="en-US"><voice name="en-US-DavisNeural"><s /><mstts:express-as style="whispering">As the door beeps open, I enter the house. There is no voice besides my steps... Then someone loudly yelled ${context.PlayerName}! My name! And I turned my back.</mstts:express-as><s /></voice></speak>`,
            }),
            
          },
          assign({
            imageUrl: "https://github.com/Bora-Valar-Kara/dialogue-systems-1-2025/blob/main/edited11.png?raw=true",
          }),
        ],
        on: { SPEAK_COMPLETE: "HouseEntranceAsk" },
      },

      NoInput: {
        entry: [
          { type: "spst.speak", params: { utterance: `` } },
          assign({
            imageUrl: "https://github.com/Bora-Valar-Kara/dialogue-systems-1-2025/blob/main/edited11.png?raw=true",
          }),
        ],
        on: { SPEAK_COMPLETE: "HouseEntranceAsk" },
      },

      HouseEntranceAsk: {
        entry: { type: "spst.listen" },
        on: {
          RECOGNISED: {
            actions: assign(({ event }) => {
              return { 
                lastResult: event.value, 
                interpretation: event.nluValue 
              }; 
            }),
          },
          ASR_NOINPUT: {
            actions: assign({ lastResult: null }),
          },
        },
      },

      // ExploreAround state gives more information about the surrounding area and gives important clues to the player.
      ExploreAround: {
        entry: [
          { type: "spst.speak", params: {utterance: `You take your time and explore around a little bit. You see a blue door. The blue door is the door you came from. Additionally, you can go to the yellow door. There seems to be a sour, awful smell coming from that room. Additionally you can say "go back" to go the second entrance of the house or you can go to the stairs to the right.` } },
          assign({
            imageUrl: "https://github.com/Bora-Valar-Kara/dialogue-systems-1-2025/blob/main/edited11.png?raw=true",
          }),
        ],
        on: { SPEAK_COMPLETE: "NoInput" },
      },

      // ExamineInventory state simply lists the items in the player's inventory.
      ExamineInventory: {
        entry: { type: "spst.speak", params: ({ context }) => ({ utterance: `You have the following items in your inventory: ${context.Inventory.join(", ")}` }) }, // by using join(", ") we can separate the items with a comma so we can read them here.
        on: { SPEAK_COMPLETE: "NoInput" },
      },
      
      // ContextualHelp state gives the player information about the possible actions they can take.
      ContextualHelp: {
        entry: { type: "spst.speak", params: { utterance: `You can go back to the entrance or you can explore around. You can go to the yellow door or the blue door. You can go to the stairs to the right. You can examine your inventory or explore around.` } },
        on: { SPEAK_COMPLETE: "NoInput"}
      },
    },
  },

    YellowRoom: { // 1-Explore Around 2- Examine Inventory 3- Ask for help 4- Go Back 5- Take the key
      initial: "YellowRoomPrompt",
      on: {        
        LISTEN_COMPLETE: [
          
        { target: "HouseEntrance.NoInput", // If we say to go to previous state, we can send the player back to the HouseEntrance state.
          guard: ({ context }) => 
          context.interpretation?.topIntent === "MoveToX" &&
          getDirection(context) === "previous" || getDirection(context) === "back", 
        },

        { target: "HouseEntrance.NoInput", // Alternatively the door with the yellow color will take the player back to the HouseEntrance state.
          guard: ({ context }) => 
          context.interpretation?.topIntent === "GoToDoorWithColorX" &&
          getDoorColor(context) === "yellow",
        },


        { target: "HouseEntrance.NoInput", // If the player wants to exit the room, they can say "exit the room" and they will be taken back to the HouseEntrance state.
          guard: ({ context }) => 
          context.interpretation?.topIntent === "ExitTheRoom",
        },


        { target: ".TakeTheKey", // This state will pick up the green key and add it to the player's inventory.
          guard: ({ context }) => 
          context.interpretation?.topIntent === "TakeTheKey" &&
          !context.Inventory.includes("a green key"),
        },

        { target: ".ExploreAround",
          guard: ({ context }) => 
          context.interpretation?.topIntent === "ExploreAround",
        },

        { target: ".ExamineInventory",
          guard: ({ context }) =>
          context.interpretation?.topIntent === "ExamineInventory",
        },

        { target: ".ContextualHelp",
          guard: ({ context }) => 
          context.interpretation?.topIntent === "AskContextualHelp",
        },

        { target: ".NoInput" }, 
      ],
      },
      states: {
        YellowRoomPrompt: {
          entry: [
            { type: "azure.speakSSML", params: { ssml: `<!--ID=B7267351-473F-409D-9765-754A8EBCDE05;Version=1|{"VoiceNameToIdMapItems":[{"Id":"b5f86142-ce84-4483-8142-45db0d778add","Name":"Microsoft Server Speech Text to Speech Voice (en-US, DavisNeural)","ShortName":"en-US-DavisNeural","Locale":"en-US","VoiceType":"StandardVoice"}]}-->
<!--ID=FCB40C2B-1F9F-4C26-B1A1-CF8E67BE07D1;Version=1|{"Files":{}}-->
<!--ID=5B95B1CC-2C7B-494F-B746-CF22A0E779B7;Version=1|{"Locales":{"en-US":{"AutoApplyCustomLexiconFiles":[{}]}}}-->
<speak xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="http://www.w3.org/2001/mstts" xmlns:emo="http://www.w3.org/2009/10/emotionml" version="1.0" xml:lang="en-US"><voice name="en-US-DavisNeural"><s /><mstts:express-as style="whispering" styledegree="0.6">I enter the yellow door to a small room... It is a... toilet.</mstts:express-as><s /></voice></speak>` } },
            assign({
              imageUrl: "https://github.com/Bora-Valar-Kara/dialogue-systems-1-2025/blob/main/edited12.png?raw=true",
            }), 
          ],
          on: { SPEAK_COMPLETE: "YellowRoomAsk" },
        },

        NoInput: {
          entry: { type: "spst.speak", params: { utterance: `` } },
          on: { SPEAK_COMPLETE: "YellowRoomAsk" },
        },

        YellowRoomAsk: {
          entry: { type: "spst.listen" },
          on: {
            RECOGNISED: {
              actions: assign(({ event }) => {
                return { 
                  lastResult: event.value, 
                  interpretation: event.nluValue 
                }; 
              }),
            },
            ASR_NOINPUT: {
              actions: assign({ lastResult: null }),
            },
          },
        },

        // TakeTheKey state will add the green key to the player's inventory.
        TakeTheKey: {
          entry: [
            assign(({ context }) => ({
              Inventory: [...context.Inventory, "a green key"],
            })),
            { type: "spst.speak", params: { utterance: `You find a green key. You take the key with you.` } },
            assign({
              imageUrl: "https://github.com/Bora-Valar-Kara/dialogue-systems-1-2025/blob/main/edited13.png?raw=true",
            }),
          ],
          on: { SPEAK_COMPLETE: "#DM.YellowRoomNoItem" }, // no itema gidecek
        },

        // ExploreAround state gives more information about the surrounding area and gives important clues to the player.
        ExploreAround: {
          entry: { type: "spst.speak", params: {utterance: `The room's light is dim. And the room smells good for a toilet. You can see a door with a yellow color. And... there seems to be a green key on top of toilet paper. It seems to be useful. Although... Why is it there?` } },
          on: { SPEAK_COMPLETE: "NoInput" },  
        },

        // ExamineInventory state simply lists the items in the player's inventory.
        ExamineInventory: {
        entry: { type: "spst.speak", params: ({ context }) => ({ utterance: `You have the following items in your inventory: ${context.Inventory.join(", ")}` }) }, // by using join(", ") we can separate the items with a comma so we can read them here.
        on: { SPEAK_COMPLETE: "NoInput" },
        },

        // ContextualHelp state gives the player information about the possible actions they can take.
        ContextualHelp: {
          entry: { type: "spst.speak", params: { utterance: `You can go back to the entrance or you can explore around. Say something like "Take Item" or "Take the Key" to take the item. You can examine your inventory.` } },
          on: { SPEAK_COMPLETE: "NoInput" },
        },
      },
    },

    YellowRoomNoItem: { // 1-Explore Around 2- Examine Inventory 3- Ask for help 4- Go Back
      initial: "YellowRoomNoItemPrompt",
      on: {
        LISTEN_COMPLETE: [

        { target: "HouseEntrance.NoInput", 
          guard: ({ context }) => 
          context.interpretation?.topIntent === "MoveToX" &&
          getDirection(context) === "previous", 
        },

        { target: "HouseEntrance.NoInput", 
          guard: ({ context }) => 
          context.interpretation?.topIntent === "GoToDoorWithColorX" &&
          getDoorColor(context) === "yellow",
        },

        { target: "HouseEntrance.NoInput", 
          guard: ({ context }) => 
          context.interpretation?.topIntent === "ExitTheRoom",
        },

        { target: ".ExploreAround",
          guard: ({ context }) => 
          context.interpretation?.topIntent === "ExploreAround",
        },

        { target: ".ExamineInventory",
          guard: ({ context }) =>
          context.interpretation?.topIntent === "ExamineInventory",
        },

        { target: ".ContextualHelp",
          guard: ({ context }) => 
          context.interpretation?.topIntent === "AskContextualHelp",
        },

        { target: ".NoInput" }, 
      ],
      },
      states: {
        YellowRoomNoItemPrompt: {
          entry: [
            { type: "azure.speakSSML", params: { ssml: `<!--ID=B7267351-473F-409D-9765-754A8EBCDE05;Version=1|{"VoiceNameToIdMapItems":[{"Id":"b5f86142-ce84-4483-8142-45db0d778add","Name":"Microsoft Server Speech Text to Speech Voice (en-US, DavisNeural)","ShortName":"en-US-DavisNeural","Locale":"en-US","VoiceType":"StandardVoice"}]}-->
<!--ID=FCB40C2B-1F9F-4C26-B1A1-CF8E67BE07D1;Version=1|{"Files":{}}-->
<!--ID=5B95B1CC-2C7B-494F-B746-CF22A0E779B7;Version=1|{"Locales":{"en-US":{"AutoApplyCustomLexiconFiles":[{}]}}}-->
<speak xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="http://www.w3.org/2001/mstts" xmlns:emo="http://www.w3.org/2009/10/emotionml" version="1.0" xml:lang="en-US"><voice name="en-US-DavisNeural"><s /><mstts:express-as style="whispering" styledegree="0.7">I have taken the green key. There seems nothing left to do here.</mstts:express-as><s /></voice></speak>` } },
            assign({
              imageUrl: "https://github.com/Bora-Valar-Kara/dialogue-systems-1-2025/blob/main/edited13.png?raw=true",
            }),
          ],
          on: { SPEAK_COMPLETE: "YellowRoomNoItemAsk" },
        },

        NoInput: {
          entry: { type: "spst.speak", params: { utterance: `` } },
          on: { SPEAK_COMPLETE: "YellowRoomNoItemAsk" },
        },

        YellowRoomNoItemAsk: {
          entry: { type: "spst.listen" },
          on: {
            RECOGNISED: {
              actions: assign(({ event }) => {
                return { 
                  lastResult: event.value, 
                  interpretation: event.nluValue 
                }; 
              }),
            },
            ASR_NOINPUT: {
              actions: assign({ lastResult: null }),
            },
          },
        },

        // ExploreAround state gives more information about the surrounding area and gives important clues to the player.
        ExploreAround: {
          entry: { type: "spst.speak", params: {utterance: `The room's light is dim. And the room smells good for a toilet. You can see a door with a yellow color. There is nothing left to do here.` } },
          on: { SPEAK_COMPLETE: "NoInput" },
        },

        // ExamineInventory state simply lists the items in the player's inventory.
        ExamineInventory: {
          entry: { type: "spst.speak", params: ({ context }) => ({ utterance: `You have the following items in your inventory: ${context.Inventory.join(", ")}` }) }, // by using join(", ") we can separate the items with a comma so we can read them here.
          on: { SPEAK_COMPLETE: "NoInput" },
        },

        // ContextualHelp state gives the player information about the possible actions they can take.
        ContextualHelp: {
          entry: { type: "spst.speak", params: { utterance: `You can go back to the entrance or you can explore around. There is nothing left to do here.` } },
          on: { SPEAK_COMPLETE: "NoInput" },
        },
      },
    },

    SecondEntranceInside: { // 1-Explore Around 2- Examine Inventory 3- Ask for help 4- Go Back/Right 5- Open the white door 6- Open the green door
      initial: "SecondEntranceInsidePrompt",
      on: {        
        LISTEN_COMPLETE: [
          
        { target: "HouseEntrance.NoInput", // If we say to go to previous state, we can send the player back to the HouseEntrance state.
          guard: ({ context }) => 
          context.interpretation?.topIntent === "MoveToX" &&
          getDirection(context) === "previous" || getDirection(context) === "back" || getDirection(context) === "right", 
        },

        { target: "WhiteDoorLocked", // The white door is locked. If the player tries to go to the white door, they will be informed that the door is locked.
          guard: ({ context }) => 
          context.interpretation?.topIntent === "GoToDoorWithColorX" &&
          getDoorColor(context) === "white",
        },

        { target: "GreenRoom", // The green door will take the player to the GreenRoom state. But the state should only take place if the player has the green key ("a green key") in their inventory.
          guard: ({ context }) => 
          context.interpretation?.topIntent === "GoToDoorWithColorX" &&
          getDoorColor(context) === "green" &&
          context.Inventory.includes("a green key"),
        },

        { target: ".GreenRoomLocked", //
          guard: ({ context }) => 
          context.interpretation?.topIntent === "GoToDoorWithColorX" &&
          getDoorColor(context) === "green" &&
          !context.Inventory.includes("a green key"),
        },

        { target: ".ExploreAround", 
          guard: ({ context }) => 
          context.interpretation?.topIntent === "ExploreAround",
        },

        { target: ".ExamineInventory",
          guard: ({ context }) =>
          context.interpretation?.topIntent === "ExamineInventory",
        },

        { target: ".ContextualHelp",
          guard: ({ context }) => 
          context.interpretation?.topIntent === "AskContextualHelp",
        },
        
        { target: ".NoInput" },
        ],
      },
      states: {
        SecondEntranceInsidePrompt: {
          entry: [
            { type: "azure.speakSSML", params: { ssml: `<!--ID=B7267351-473F-409D-9765-754A8EBCDE05;Version=1|{"VoiceNameToIdMapItems":[{"Id":"b5f86142-ce84-4483-8142-45db0d778add","Name":"Microsoft Server Speech Text to Speech Voice (en-US, DavisNeural)","ShortName":"en-US-DavisNeural","Locale":"en-US","VoiceType":"StandardVoice"}]}-->
<!--ID=FCB40C2B-1F9F-4C26-B1A1-CF8E67BE07D1;Version=1|{"Files":{}}-->
<!--ID=5B95B1CC-2C7B-494F-B746-CF22A0E779B7;Version=1|{"Locales":{"en-US":{"AutoApplyCustomLexiconFiles":[{}]}}}-->
<speak xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="http://www.w3.org/2001/mstts" xmlns:emo="http://www.w3.org/2009/10/emotionml" version="1.0" xml:lang="en-US"><voice name="en-US-DavisNeural"><mstts:express-as style="whispering" styledegree="0.7">I am now in the second entrance of the house. There is a strange odor here.</mstts:express-as></voice></speak>` } },
            assign({
              imageUrl: "https://github.com/Bora-Valar-Kara/dialogue-systems-1-2025/blob/main/edited14.png?raw=true",
            }),
        ],
          on: { SPEAK_COMPLETE: "SecondEntranceInsideAsk" },
        },

        NoInput: {
          entry: { type: "spst.speak", params: { utterance: `` } },
          on: { SPEAK_COMPLETE: "SecondEntranceInsideAsk" },
        },

        SecondEntranceInsideAsk: {
          entry: { type: "spst.listen" },
          on: {
            RECOGNISED: {
              actions: assign(({ event }) => {
                return { 
                  lastResult: event.value, 
                  interpretation: event.nluValue 
                }; 
              }),
            },
            ASR_NOINPUT: {
              actions: assign({ lastResult: null }),
            },
          },
        },

        // GreenRoomLocked state will inform the player that the green door is locked and they need a key to unlock it.
        GreenRoomLocked: {
          entry: { type: "spst.speak", params: { utterance: `The green door is locked. It seems you need a key to unlock it.` } },
          on: { SPEAK_COMPLETE: "NoInput" },
        },

        // ExploreAround state gives more information about the surrounding area and gives important clues to the player.
        ExploreAround: {
          entry: { type: "spst.speak", params: {utterance: `You can go back to the entrance or you can explore around. There is a green door and a white door. The white door is locked. You can go back to the entrance or you can explore around.` } },
          on: { SPEAK_COMPLETE: "NoInput" },
        },

        // ExamineInventory state simply lists the items in the player's inventory.
        ExamineInventory: {
          entry: { type: "spst.speak", params: ({ context }) => ({ utterance: `You have the following items in your inventory: ${context.Inventory.join(", ")}` }) }, // by using join(", ") we can separate the items with a comma so we can read them here.
          on: { SPEAK_COMPLETE: "NoInput" },
        },

        // ContextualHelp state gives the player information about the possible actions they can take.
        ContextualHelp: {
          entry: { type: "spst.speak", params: { utterance: `You can go back to the entrance or you can explore around. There is a green door and a white door. The white door seems to be locked. You can go back to the entrance or you can explore around.` } },
          on: { SPEAK_COMPLETE: "NoInput" },
        },
      },
    },

    WhiteDoorLocked: { 
      entry: { type: "spst.speak", params: { utterance: `The white door is locked. And the lock is so rusty as if it hasn't been used since forever. You are sure you cannot force open this one.` } },
      on: { SPEAK_COMPLETE: "SecondEntranceInside.NoInput" },
    },

    GreenRoom:{ // 1-Explore Around 2- Examine Inventory 3- Ask for help 4- Go Back 5- Open the green door 6- Approach the flowers/table
      initial: "GreenRoomPrompt",
      on: {        
        LISTEN_COMPLETE: [
          
        { target: "#DM.SecondEntranceInside", // If we say to go to previous state, we can send the player back to the HouseEntrance state.
          guard: ({ context }) => 
          context.interpretation?.topIntent === "MoveToX" &&
          getDirection(context) === "previous" || getDirection(context) === "back" || getDirection(context) === "right", 
        },

        { target: "#DM.SecondEntranceInside", // The green door will take the player to the GreenRoom?? state.
          guard: ({ context }) => 
          context.interpretation?.topIntent === "GoToDoorWithColorX" &&
          getDoorColor(context) === "green",
        },

        { target: "#DM.SecondEntranceInside", // If the player wants to exit the room, they can say "exit the room" and they will be taken back to the HouseEntrance state.
          guard: ({ context }) => 
          context.interpretation?.topIntent === "ExitTheRoom",
        },


        { target: "Approached_Flowers", // The player can approach the flowers in the room. This is where the player can find the grey key. So this should only trigger if the player does not have the grey key in their inventory.
          guard: ({ context }) =>
          context.interpretation?.topIntent === "ApproachX" &&
          !context.Inventory.includes("a grey key"), 
        },

        { target: ".Approached_Flowers_Invalid", // If the player has the grey key in their inventory, they can't approach the flowers again. This state says like "You see nothing useful there." 
          guard: ({ context }) =>
          context.interpretation?.topIntent === "ApproachX" &&
          context.Inventory.includes("a grey key"), 
        },

        { target: ".ExploreAround", 
          guard: ({ context }) => 
          context.interpretation?.topIntent === "ExploreAround",
        },

        { target: ".ExamineInventory",
          guard: ({ context }) =>
          context.interpretation?.topIntent === "ExamineInventory",
        },

        { target: ".ContextualHelp",
          guard: ({ context }) => 
          context.interpretation?.topIntent === "AskContextualHelp",
        },
        
        { target: ".NoInput" },
        ],
      },
      states: {
        GreenRoomPrompt: {
          entry: [
            { type: "azure.speakSSML", params: { ssml: `<!--ID=B7267351-473F-409D-9765-754A8EBCDE05;Version=1|{"VoiceNameToIdMapItems":[{"Id":"b5f86142-ce84-4483-8142-45db0d778add","Name":"Microsoft Server Speech Text to Speech Voice (en-US, DavisNeural)","ShortName":"en-US-DavisNeural","Locale":"en-US","VoiceType":"StandardVoice"}]}-->
<!--ID=FCB40C2B-1F9F-4C26-B1A1-CF8E67BE07D1;Version=1|{"Files":{}}-->
<!--ID=5B95B1CC-2C7B-494F-B746-CF22A0E779B7;Version=1|{"Locales":{"en-US":{"AutoApplyCustomLexiconFiles":[{}]}}}-->
<speak xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="http://www.w3.org/2001/mstts" xmlns:emo="http://www.w3.org/2009/10/emotionml" version="1.0" xml:lang="en-US"><voice name="en-US-DavisNeural"><mstts:express-as style="whispering" styledegree="0.7">I am inside now...</mstts:express-as></voice></speak>` } },
            assign({
              imageUrl: "https://github.com/Bora-Valar-Kara/dialogue-systems-1-2025/blob/main/edited15.png?raw=true",
            }),
          ],
          on: { SPEAK_COMPLETE: "GreenRoomAsk" },
        },

        NoInput: {
          entry: { type: "spst.speak", params: { utterance: `` } },
          on: { SPEAK_COMPLETE: "GreenRoomAsk" },
        },

        GreenRoomAsk: {
          entry: { type: "spst.listen" },
          on: {
            RECOGNISED: {
              actions: assign(({ event }) => {
                return { 
                  lastResult: event.value, 
                  interpretation: event.nluValue 
                }; 
              }),
            },
            ASR_NOINPUT: {
              actions: assign({ lastResult: null }),
            },
          },
        },

        // Approached_Flowers_Invalid state will inform the player that they have already taken the grey key.
        Approached_Flowers_Invalid: {
          entry: { type: "spst.speak", params: { utterance: `You have already taken the key. You see nothing else useful near the vase.` } },
          on: { SPEAK_COMPLETE: "NoInput" },
        },

        // ExploreAround state gives more information about the surrounding area and gives important clues to the player.
        ExploreAround: {
          entry: { type: "spst.speak", params: {utterance: `The room is dimly lit and the furnitures are new. There are numerous decorations. There is a glistening item in the next to flowers in the vase that catches your eye.` } },
          on: { SPEAK_COMPLETE: "NoInput" },
        },

        // ExamineInventory state simply lists the items in the player's inventory.
        ExamineInventory: {
          entry: { type: "spst.speak", params: ({ context }) => ({ utterance: `You have the following items in your inventory: ${context.Inventory.join(", ")}` }) }, // by using join(", ") we can separate the items with a comma so we can read them here.
          on: { SPEAK_COMPLETE: "NoInput" },
        },

        // ContextualHelp state gives the player information about the possible actions they can take.
        ContextualHelp: {
          entry: { type: "spst.speak", params: { utterance: `There is vase with flowers that you can approach. You can go back to the entrance or you can explore around. You can examine your inventory.` } },
          on: { SPEAK_COMPLETE: "NoInput" },
        },
      },
    },

    Approached_Flowers: { // 1-Explore Around 2- Examine Inventory 3- Ask for help 4- Go Back 5- Take the key
      initial: "Approached_FlowersPrompt",
      on: {        
        LISTEN_COMPLETE: [

        { target: "GreenRoom.NoInput", 
          guard: ({ context }) => 
          context.interpretation?.topIntent === "MoveToX" && // if the player says "previous" or "back" as direction, we can send them back to the FirstEntrance state.
          getDirection(context) === "back" || getDirection(context) === "previous",
        },

        { target: ".TakeTheKey", // This state will pick up the stick and add it to the player's inventory.
          guard: ({ context }) => 
          context.interpretation?.topIntent === "TakeTheKey",
        },

        { target: ".ExploreAround",
          guard: ({ context }) => 
          context.interpretation?.topIntent === "ExploreAround",
        },

        { target: ".ExamineInventory",
          guard: ({ context }) =>
          context.interpretation?.topIntent === "ExamineInventory",
        },

        { target: ".ContextualHelp",
          guard: ({ context }) => 
          context.interpretation?.topIntent === "AskContextualHelp",
        },

        { target: ".NoInput" }, 
      ],
      },
      states: {

        Approached_FlowersPrompt: {
          entry: [
            { type: "spst.speak", params: { utterance: `` } },
            assign({
              imageUrl: "https://github.com/Bora-Valar-Kara/dialogue-systems-1-2025/blob/main/edited16.png?raw=true",
            }), 
          ],
          on: { SPEAK_COMPLETE: "Approached_FlowersAsk" },
        },

        NoInput: {
          entry: { type: "spst.speak", params: { utterance: `` } },
          on: { SPEAK_COMPLETE: "Approached_FlowersAsk" },
        },

        Approached_FlowersAsk: {
          entry: { type: "spst.listen" },
          on: {
            RECOGNISED: {
              actions: assign(({ event }) => {
                return { 
                  lastResult: event.value, 
                  interpretation: event.nluValue 
                }; 
              }),
            },
            ASR_NOINPUT: {
              actions: assign({ lastResult: null }),
            },
          },
        },

        // TakeTheStick state will add the stick to the player's inventory.
        TakeTheKey: {
          entry: [
            assign(({ context }) => ({
              Inventory: [...context.Inventory, "a grey key"],
            })),
            { type: "spst.speak", params: { utterance: `You find a grey key. You take the key with you.` } },
            assign({
              imageUrl: "https://github.com/Bora-Valar-Kara/dialogue-systems-1-2025/blob/main/edited17.png?raw=true",
            }),
          ],
          on: { SPEAK_COMPLETE: "#DM.GreenRoom" }, // #DM is necessary because we are transitioning to a state in a different machine. So we need to specify the machine name.
        },

        // ExploreAround state gives more information about the surrounding area and gives important clues to the player.
        ExploreAround: {
          entry: { type: "spst.speak", params: {utterance: `It looks like a vase of flowers. The flowers are lively and well attended. And there seems to be a grey key on the vase. It seems to be useful. Who may have put it there?` } },
          on: { SPEAK_COMPLETE: "NoInput" },
        },

        // ExamineInventory state simply lists the items in the player's inventory.
        ExamineInventory: {
          entry: { type: "spst.speak", params: ({ context }) => ({ utterance: `You have the following items in your inventory: ${context.Inventory.join(", ")}` }) }, // by using join(", ") we can separate the items with a comma so we can read them here.
          on: { SPEAK_COMPLETE: "NoInput" },
        },

        // ContextualHelp state gives the player information about the possible actions they can take.
        ContextualHelp: {
          entry: { type: "spst.speak", params: { utterance: `You can take the items by saying it, or you can go back to the entrance by saying something like "go back" or "go to the previous state". You can additionally examine your inventory or ask to explore around!` } },
          on: { SPEAK_COMPLETE: "NoInput" },
        },
      },
    },

    Staircase: { // 1-Explore Around 2- Examine Inventory 3- Ask for help 4- Open the grey door 5- Go back/left
      initial: "StaircasePrompt",
      on: {        
        LISTEN_COMPLETE: [
          
        { target: "#DM.GreyDoor",
          guard: ({ context }) =>
          context.interpretation?.topIntent === "GoToDoorWithColorX" &&
          getDoorColor(context) === "grey" &&
          context.Inventory.includes("a grey key"),
        },

        { target: "#DM.GreyDoorFailed",
          guard: ({ context }) => 
          context.interpretation?.topIntent === "GoToDoorWithColorX" &&
          getDoorColor(context) === "grey" &&
          !context.Inventory.includes("a grey key"),
        },

        { target: "#DM.HouseEntrance.NoInput", // If the player has the grey key in their inventory, they can't approach the flowers again. This state says like "You see nothing useful there." 
          guard: ({ context }) =>
          context.interpretation?.topIntent === "MoveToX" &&
          getDirection(context) === "previous" || getDirection(context) === "back" || getDirection(context) === "left", 
        },

        { target: ".ExploreAround", 
          guard: ({ context }) => 
          context.interpretation?.topIntent === "ExploreAround",
        },

        { target: ".ExamineInventory",
          guard: ({ context }) =>
          context.interpretation?.topIntent === "ExamineInventory",
        },

        { target: ".ContextualHelp",
          guard: ({ context }) => 
          context.interpretation?.topIntent === "AskContextualHelp",
        },
        
        { target: ".NoInput" },
        ],
      },
      states: {
        StaircasePrompt: {
          entry: [
            { type: "azure.speakSSML", params: { ssml: `<!--ID=B7267351-473F-409D-9765-754A8EBCDE05;Version=1|{"VoiceNameToIdMapItems":[{"Id":"b5f86142-ce84-4483-8142-45db0d778add","Name":"Microsoft Server Speech Text to Speech Voice (en-US, DavisNeural)","ShortName":"en-US-DavisNeural","Locale":"en-US","VoiceType":"StandardVoice"}]}-->
<!--ID=FCB40C2B-1F9F-4C26-B1A1-CF8E67BE07D1;Version=1|{"Files":{}}-->
<!--ID=5B95B1CC-2C7B-494F-B746-CF22A0E779B7;Version=1|{"Locales":{"en-US":{"AutoApplyCustomLexiconFiles":[{}]}}}-->
<speak xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="http://www.w3.org/2001/mstts" xmlns:emo="http://www.w3.org/2009/10/emotionml" version="1.0" xml:lang="en-US"><voice name="en-US-DavisNeural"><mstts:express-as style="whispering" styledegree="0.7">This floor is much colder compared to the ground floor! Hmm... This grey door looks important, and requires its key to enter. And... The staircase looks totally blocked with clutter. I can't go there. </mstts:express-as></voice></speak>` } },
            assign({
              imageUrl: "https://github.com/Bora-Valar-Kara/dialogue-systems-1-2025/blob/main/edited18.png?raw=true",
            }),
          ],
          on: { SPEAK_COMPLETE: "StaircaseAsk" },
        },

        NoInput: {
          entry: { type: "spst.speak", params: { utterance: `` } },
          on: { SPEAK_COMPLETE: "StaircaseAsk" },
        },

        StaircaseAsk: {
          entry: { type: "spst.listen" },
          on: {
            RECOGNISED: {
              actions: assign(({ event }) => {
                return { 
                  lastResult: event.value, 
                  interpretation: event.nluValue 
                }; 
              }),
            },
            ASR_NOINPUT: {
              actions: assign({ lastResult: null }),
            },
          },
        },

        // ExploreAround state gives more information about the surrounding area and gives important clues to the player.
        ExploreAround: {
          entry: { type: "spst.speak", params: {utterance: `It feels like the grey door is important. If I don't have the grey key, I may find it if I look around more.` } },
          on: { SPEAK_COMPLETE: "StaircaseAsk" },
        },

        // ExamineInventory state simply lists the items in the player's inventory.
        ExamineInventory: {
          entry: { type: "spst.speak", params: ({ context }) => ({ utterance: `You have the following items in your inventory: ${context.Inventory.join(", ")}` }) }, // by using join(", ") we can separate the items with a comma so we can read them here.
          on: { SPEAK_COMPLETE: "StaircaseAsk" },
        },

        // ContextualHelp state gives the player information about the possible actions they can take.
        ContextualHelp: {
          entry: { type: "spst.speak", params: { utterance: `You can try to open the grey door or go back to entrance.` } },
          on: { SPEAK_COMPLETE: "StaircaseAsk" },
        },
      },
    },

    GreyDoorFailed: {
      entry: [
        { type: "spst.speak", params: { utterance: `The grey door is locked. I need the key.` } },
        assign({
          imageUrl: "https://github.com/Bora-Valar-Kara/dialogue-systems-1-2025/blob/main/edited18.png?raw=true",
        }),
      ],
      on: { SPEAK_COMPLETE: "#DM.Staircase" },
    },

    GreyDoor: {
      entry: [
        stopAllMedia,
        assign({
          videoUrl: "https://github.com/Bora-Valar-Kara/dialogue-systems-1-2025/raw/refs/heads/main/final.mp4",
        }),
      ],
      on: {
        CLICK: "Prepare",
      },
    },
    

    PaperPickup: {
      initial: "PaperPrompt1",
      
      states: {
        PaperPrompt1: {
          entry: [

            assign(({ context }) => ({
              Inventory: [...context.Inventory, "paper with the code 295233"],
            })),

            assign({
              imageUrl: "https://github.com/Bora-Valar-Kara/dialogue-systems-1-2025/blob/main/Paper1.png?raw=true"
            }),

            { 
              type: "spst.speak", 
              params: { utterance: `You took the stick from your inventory.` } 
            }

        ],
          on: { SPEAK_COMPLETE: "PaperPrompt2" },
        },
        
        PaperPrompt2: {
          entry: [

            assign({
              imageUrl: "https://github.com/Bora-Valar-Kara/dialogue-systems-1-2025/blob/main/paper2.png?raw=true"
            }),

            { 
              type: "spst.speak", 
              params: { utterance: `Used it to poke the paper plane stuck in the tree. ` } 
            }

        ],
          on: { SPEAK_COMPLETE: "PaperPrompt3" },
        },

        PaperPrompt3: {
          entry: [

            assign({
              imageUrl: "https://github.com/Bora-Valar-Kara/dialogue-systems-1-2025/blob/main/paper3,.png?raw=true"
            }),

            { 
              type: "spst.speak", 
              params: { utterance: `It falls.` } 
            }

        ],
          on: { SPEAK_COMPLETE: "PaperPrompt4" },
        },

        PaperPrompt4: {
          entry: [

            assign({
              imageUrl: "https://github.com/Bora-Valar-Kara/dialogue-systems-1-2025/blob/main/paper4.png?raw=true"
            }),

            { 
              type: "spst.speak", 
              params: { utterance: `You pick it up.  ` } 
            }

        ],
          on: { SPEAK_COMPLETE: "PaperPrompt5" },
        },

        PaperPrompt5: {
          entry: [

            assign({
              imageUrl: "https://github.com/Bora-Valar-Kara/dialogue-systems-1-2025/blob/main/paper5.png?raw=true"
            }),

            { 
              type: "spst.speak", 
              params: { utterance: `When you open it with haste, you see that someone wrote help and a 6 digit code below. It is 2 9 5 2 3 3. You can look at it again by examining your inventory if you don't remember. ` } 
            }

        ],
          on: { SPEAK_COMPLETE: "#DM.BackyardNoItem.NoInput" },
        },

      },
    },

    Backyard: { // 1-Explore Around 2- Examine Inventory 3- Ask for help 4- Use the item / Use the stick 5- Take the paper
      initial: "BackyardPrompt",
      on: {        
        LISTEN_COMPLETE: [
        {
          target: "#DM.PaperPickup",
          guard: ({ context }) => 
          context.interpretation?.topIntent === "UseItemX" &&
          getUsableObject(context) === "stick" &&
          context.Inventory.includes("a brown stick"),
        },

        {
          target: "#DM.PaperPickup",
          guard: ({ context }) => 
          context.interpretation?.topIntent === "TakeThePaper" &&
          context.Inventory.includes("a brown stick")
        },

        { target: "#DM.FirstEntrance.NoInput", 
          guard: ({ context }) => 
          context.interpretation?.topIntent === "MoveToX" &&
          (getDirection(context) === "left" || getDirection(context) === "back")
        },

        { // If the player does not have a stick in their inventory but wants to take the paper, they will be informed that they need a stick.
          target: ".PaperPickupFail",
          guard: ({ context }) =>
          context.interpretation?.topIntent === "TakeThePaper" &&
          !context.Inventory.includes("a brown stick"),
        },

        { target: ".ExploreAround",
          guard: ({ context }) => 
          context.interpretation?.topIntent === "ExploreAround",
        },

        { target: ".ContextualHelp",
          guard: ({ context }) => 
          context.interpretation?.topIntent === "AskContextualHelp",
        },

        { target: ".ExamineInventory",
          guard: ({ context }) =>
          context.interpretation?.topIntent === "ExamineInventory",
        },

        { target: ".NoInput" }, 
      ],
      },
      states: {
        BackyardPrompt: {
          entry: [
            { type: "spst.speak", params: ({ utterance: `You find yourself in the backyard.` }) },
            assign({
              imageUrl: "https://github.com/Bora-Valar-Kara/dialogue-systems-1-2025/blob/main/edited8.png?raw=true",
            }), 
          ],
          on: { SPEAK_COMPLETE: "BackyardAsk" },
        },

        NoInput: {
          entry: { type: "spst.speak", params: { utterance: `` } },
          on: { SPEAK_COMPLETE: "BackyardAsk" },
        },

        BackyardAsk: {
          entry: { type: "spst.listen" },
          on: {
            RECOGNISED: {
              actions: assign(({ event }) => {
                return { 
                  lastResult: event.value, 
                  interpretation: event.nluValue 
                }; 
              }),
            },
            ASR_NOINPUT: {
              actions: assign({ lastResult: null }),
            },
          },
        },

        PaperPickupFail: {
          entry: { type: "spst.speak", params: { utterance: `The paper seems to be interesting but totally out of your reach. You need to find a way to take it from there.` } },
          on: { SPEAK_COMPLETE: "#DM.Backyard.NoInput" },
        },

        // ExploreAround state gives more information about the surrounding area and gives important clues to the player.
        ExploreAround: {
          entry: { type: "spst.speak", params: {utterance: `You see that there is some kind of paper plane stuck in the tree which may possibly came from the window above.` } },
          on: { SPEAK_COMPLETE: "#DM.Backyard.NoInput" },
        },

        // ExamineInventory state simply lists the items in the player's inventory.
        ExamineInventory: {
          entry: { type: "spst.speak", params: ({ context }) => ({ utterance: `You have the following items in your inventory: ${context.Inventory.join(", ")}` }) }, // by using join(", ") we can separate the items with a comma so we can read them here.
          on: { SPEAK_COMPLETE: "#DM.Backyard.NoInput" },
        },
        
        // ContextualHelp state gives the player information about the possible actions they can take.
        ContextualHelp: {
          entry: { type: "spst.speak", params: { utterance: `You can use an item that you think is useful, or you can go left to go back to front entrance.` } },
          on: { SPEAK_COMPLETE: "#DM.Backyard.NoInput" },
        },
      },
    },

    BackyardNoItem: { // 1-Explore Around 2- Examine Inventory 3- Ask for help 4- Go Back 
      initial: "BackyardNoItemPrompt",
      on: {        
        LISTEN_COMPLETE: [

        { target: "#DM.FirstEntrance.NoInput", 
          guard: ({ context }) => 
          context.interpretation?.topIntent === "MoveToX" &&
          (getDirection(context) === "left" || getDirection(context) === "back")
        },

        { target: ".ExploreAround",
          guard: ({ context }) => 
          context.interpretation?.topIntent === "ExploreAround",
        },

        { target: ".ContextualHelp",
          guard: ({ context }) => 
          context.interpretation?.topIntent === "AskContextualHelp",
        },

        { target: ".ExamineInventory",
          guard: ({ context }) =>
          context.interpretation?.topIntent === "ExamineInventory",
        },

        { target: ".NoInput" }, 
      ],
      },
      states: {
        BackyardNoItemPrompt: {
          entry: [
            { type: "spst.speak", params: ({ utterance: `You are back at the backyard. There is nothing left to do here.` }) },
            assign({
              imageUrl: "https://github.com/Bora-Valar-Kara/dialogue-systems-1-2025/blob/main/edited9.png?raw=true",
            }), 
          ],
          on: { SPEAK_COMPLETE: "BackyardNoItemAsk" },
        },

        NoInput: {
          entry: [
            { type: "spst.speak", params: { utterance: `` } },
            assign({
              imageUrl: "https://github.com/Bora-Valar-Kara/dialogue-systems-1-2025/blob/main/edited9.png?raw=true",
            }),
          ],
          on: { SPEAK_COMPLETE: "BackyardNoItemAsk" },
        },

        BackyardNoItemAsk: {
          entry: { type: "spst.listen" },
          on: {
            RECOGNISED: {
              actions: assign(({ event }) => {
                return { 
                  lastResult: event.value, 
                  interpretation: event.nluValue 
                }; 
              }),
            },
            ASR_NOINPUT: {
              actions: assign({ lastResult: null }),
            },
          },
        },

        // ExploreAround state gives more information about the surrounding area and gives important clues to the player.
        ExploreAround: {
          entry: { type: "spst.speak", params: {utterance: `You are back at the backyard. There is nothing left to do here. You can go back.` } },
          on: { SPEAK_COMPLETE: "#DM.BackyardNoItem.NoInput" },
        },

        // ExamineInventory state simply lists the items in the player's inventory.
        ExamineInventory: {
          entry: { type: "spst.speak", params: ({ context }) => ({ utterance: `You have the following items in your inventory: ${context.Inventory.join(", ")}` }) }, // by using join(", ") we can separate the items with a comma so we can read them here.
          on: { SPEAK_COMPLETE: "#DM.BackyardNoItem.NoInput" },
        },
        
        // ContextualHelp state gives the player information about the possible actions they can take.
        ContextualHelp: {
          entry: { type: "spst.speak", params: { utterance: `You can say go back.` } },
          on: { SPEAK_COMPLETE: "#DM.BackyardNoItem.NoInput" },
        },
      },
    },

    Done: {
      on: {
        CLICK: "WaitToStart",
      },
    },
  },
});

const dmActor = createActor(dmMachine, {
  inspect: inspector.inspect,
}).start();

dmActor.subscribe((state) => {
  console.group("State update");
  console.log("State value:", state.value);
  console.log("State context:", state.context);
  console.groupEnd();

  const imageElement = document.getElementById("state-image") as HTMLImageElement;
  if (imageElement) {
    if (state.context.imageUrl) {
      imageElement.src = state.context.imageUrl;
      imageElement.style.display = "block";
    } else {
      imageElement.style.display = "none";
    }
  }

  const videoElement = document.getElementById("state-video") as HTMLVideoElement;
  
  // Check if video element exists and if there's a video URL in the state
  if (videoElement && state.context.videoUrl) {
    videoElement.src = state.context.videoUrl;  // Set the video URL
    videoElement.style.display = "block";        // Make the video visible
    videoElement.play();                         // Automatically play the video
  } else if (videoElement) {
    videoElement.style.display = "none";        // Hide the video if no URL is set
  }
});

export function setupButton(element: HTMLButtonElement) {
  element.addEventListener("click", () => {
    dmActor.send({ type: "CLICK" });
  });
  dmActor.subscribe((snapshot) => {
    const meta: { view?: string } = Object.values(
      snapshot.context.spstRef.getSnapshot().getMeta(),
    )[0] || {
      view: undefined,
    };
    element.innerHTML = `${meta.view}`;
  });
}

/**

{ 
            type: "azure.speakSSML",
            params: ({ context }) => ({
            ssml: `<!--ID=B7267351-473F-409D-9765-754A8EBCDE05;Version=1|{"VoiceNameToIdMapItems":[{"Id":"e5e4f59b-65c6-42b2-a6e3-5985d1a1ea07","Name":"Microsoft Server Speech Text to Speech Voice (en-US, JennyNeural)","ShortName":"en-US-JennyNeural","Locale":"en-US","VoiceType":"StandardVoice"}]}-->
<!--ID=FCB40C2B-1F9F-4C26-B1A1-CF8E67BE07D1;Version=1|{"Files":{}}-->
<!--ID=5B95B1CC-2C7B-494F-B746-CF22A0E779B7;Version=1|{"Locales":{"en-US":{"AutoApplyCustomLexiconFiles":[{}]}}}-->
<speak xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="http://www.w3.org/2001/mstts" xmlns:emo="http://www.w3.org/2009/10/emotionml" version="1.0" xml:lang="en-US"><mstts:backgroundaudio src="https://raw.githubusercontent.com/Bora-Valar-Kara/dialogue-systems-1-2025/refs/heads/main/radio.mp3" volume="2.0" /><voice name="en-US-JennyNeural"><s /><mstts:express-as style="whispering">Greetings Detective. I will be your guide in this investigation. What is your name?</mstts:express-as></voice></speak>` }) },

 */
