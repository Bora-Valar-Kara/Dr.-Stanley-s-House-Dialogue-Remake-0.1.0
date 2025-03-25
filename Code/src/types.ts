import { Hypothesis, SpeechStateExternalEvent } from "speechstate";
import { AnyActorRef } from "xstate";

export interface DMContext {
  spstRef: AnyActorRef;
  lastResult: Hypothesis[] | null;

  items: string | null;
  imageUrl: string | null;
  videoUrl: string | null;
  soundUrl: string | null;
  loop: boolean | null;

  confirm: boolean | null;
  interpretation: NLUObject | null;

  Inventory: string[];
  PlayerName: string;

}

export interface NLUObject { // This is the type of the interpretation in the DMContext.
  entities: Entity[];
  intents: Intent[];
  projectKind: string;
  topIntent: string;
}

export interface Intent { // This is the type of the intents array in the NLUObject.
  category: string;
  confidenceScore: number;
}

export interface Entity { // This is the type of the entities array in the NLUObject. 
  category: string;
  text: string;
  confidenceScore: number;
  offset: number;
  length: number;
}


export type DMEvents = 
  | SpeechStateExternalEvent 
  | { type: "CLICK" } 
  | { type: "DONE" } 
  | { type: "azure.speakSSML"; params: { ssml: string } };
