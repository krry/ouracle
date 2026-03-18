// Ouracle Engine — v3.0 (Phase 0 Rebuild)
// The engine does not discuss its inner workings.
// All internal inference (vagal, belief, quality) is metadata — not Seeker language.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomInt } from 'crypto';

// ─────────────────────────────────────────────
// THE OCTAVE OF EVOLUTION
// Source: Notion — 🎼 The Octave of Evolution
// Quality vector is the only language we offer Seekers about where they stand.
// We do not name steps. We do not diagnose. We witness.
// ─────────────────────────────────────────────

export const OCTAVE = {
  do: {
    note: 'do', act: 'sit', intent: 'be', theme: 'ground',
    quality: 'entity',
    realm: 'point', shock: false,
    seeker_language: 'a moment of presence and becoming',
  },
  re: {
    note: 're', act: 'feel', intent: 'have', theme: 'affinity',
    quality: 'affinity',
    realm: 'ray', shock: false,
    seeker_language: 'a moment of feeling and relating',
  },
  mi: {
    note: 'mi', act: 'dance', intent: 'make', theme: 'willpower',
    quality: 'activity',
    realm: 'shape', shock: false,
    seeker_language: 'a moment of making and willing',
  },
  break_4_5: {
    note: 'shock (air)', act: 'shock', intent: 'improve', theme: 'shock',
    quality: 'pity',
    realm: 'para', shock: true,
    seeker_language: 'a threshold — what you thought you were building, isn\'t',
  },
  fa: {
    note: 'fa', act: 'listen', intent: 'live', theme: 'love',
    quality: 'capacity',
    realm: 'form', shock: false,
    seeker_language: 'a moment of receiving and opening to love',
  },
  so: {
    note: 'so', act: 'sing', intent: 'say', theme: 'song',
    quality: 'causality',
    realm: 'mind', shock: false,
    seeker_language: 'a moment of voice and expression',
  },
  la: {
    note: 'la', act: 'think', intent: 'envision', theme: 'intuition',
    quality: 'eternity',
    realm: 'soul', shock: false,
    seeker_language: 'a moment of vision and pattern-seeing',
  },
  si: {
    note: 'si', act: 'intend', intent: 'know', theme: 'universality',
    quality: 'unity',
    realm: 'spirit', shock: false,
    seeker_language: 'a moment of integration and wholeness',
  },
  crisis_7_8: {
    note: 'shock (impression)', act: 'fall', intent: 'surrender', theme: 'collapse',
    quality: 'calamity',
    realm: 'meta', shock: true,
    seeker_language: 'a dissolution — the collapse that makes return possible',
  },
  do_prime: {
    note: 'do (return)', act: 'return', intent: 'complete', theme: 'reunion',
    quality: 'cyclicity',
    realm: 'all', shock: false,
    seeker_language: 'a moment of return and beginning again',
  },
};

// ─────────────────────────────────────────────
// VAGAL STATE MAP
// Internal only. Never exposed to Seeker verbatim.
// ─────────────────────────────────────────────

export const VAGAL = {
  ventral:     { quality: 'safe & social', open: true  },
  sympathetic: { quality: 'mobilized',     open: false },
  dorsal:      { quality: 'shutdown',      open: false },
  mixed:       { quality: 'flux',          open: null  },
};

// ─────────────────────────────────────────────
// LIMITING BELIEFS
// Internal only. Maps to chakra centers as inference handles.
// ─────────────────────────────────────────────

export const BELIEFS = {
  scarcity:    { chakra: 'root',    imbalance: 'excess_contraction' },
  unworthiness:{ chakra: 'sacral',  imbalance: 'lack_receptivity'   },
  control:     { chakra: 'solar',   imbalance: 'excess_holding'     },
  isolation:   { chakra: 'heart',   imbalance: 'lack_connection'    },
  silence:     { chakra: 'throat',  imbalance: 'lack_expression'    },
  blindness:   { chakra: 'brow',    imbalance: 'avoidance_of_seeing'},
  separation:  { chakra: 'crown',   imbalance: 'excess_boundary'    },
};

// ─────────────────────────────────────────────
// RITES
// The engine's output is a rite. It prescribes — the experience is
// written before it happens. "May this mantra instruct you."
//
// A rite is whole. A right is one-eyed. We offer rites.
// ─────────────────────────────────────────────

// ─────────────────────────────────────────────
// RITES — 40 rites keyed by vagal state × octave quality
//
// vagal keys:  dorsal | sympathetic | ventral | uncertain
// quality keys: entity | affinity | activity | capacity | pity |
//               causality | eternity | unity | calamity | cyclicity
//
// Octave quality ↔ chakra/belief correspondence:
//   entity    → root   → scarcity     → LAM
//   affinity  → sacral → unworthiness → VAM
//   activity  → solar  → control      → RAM
//   capacity  → heart  → isolation    → YAM
//   causality → throat → silence      → HAM
//   eternity  → brow   → blindness    → OM
//   unity     → crown  → separation   → AH
//   pity / calamity / cyclicity — transitional, no chakra anchor
// ─────────────────────────────────────────────

export const RITES = {

  // ── DORSAL ───────────────────────────────────
  // Frozen, heavy, shutdown. Meet the stillness — don't fight it.
  // Minimal ask. Body-first. One small thing, slowly.
  dorsal: {
    entity: {
      rite_name: 'The Arrival',
      act: 'Place both hands flat on any surface. Feel the temperature. Don\'t move for two minutes. That\'s all.',
      invocation: 'LAM. I am here. The ground is real.',
      textures: ['The urge to do more', 'Resistance to this being enough', 'A slow heaviness becoming warmth'],
      bija: 'LAM',
      orientation: 'love',
    },
    affinity: {
      rite_name: 'The Receiving',
      act: 'Let something arrive today that you would normally brush aside — a compliment, a warm look, sunlight on your face. Don\'t deflect it. You don\'t have to feel anything. Just don\'t push it away.',
      invocation: 'VAM. I am made to receive.',
      textures: ['The reflex to say "it\'s nothing"', 'Discomfort as you hold still', 'Something loosening if you can wait it out'],
      bija: 'VAM',
      orientation: 'love',
    },
    activity: {
      rite_name: 'The One Move',
      act: 'Do one thing you\'ve been avoiding. Not the whole task — one sentence, one dish, one step toward the door. Then stop. That\'s the rite.',
      invocation: 'RAM. I can make one thing move.',
      textures: ['Dread before the smallest step', 'Surprise at how small it actually was', 'Something unlocking in the solar plexus'],
      bija: 'RAM',
      orientation: 'love',
    },
    capacity: {
      rite_name: 'The Tending',
      act: 'Treat your body like a small child in your care. Wrap it in a blanket. Pet your own arms. Hug yourself — really hold. Foam roll your muscles if you have one. You don\'t need a reason. You don\'t need to have earned this.',
      invocation: 'YAM. I am worthy of my own tenderness.',
      textures: ['Awkwardness at self-kindness', 'Something in the body responding before the mind agrees', 'Warmth that was already there, waiting'],
      bija: 'YAM',
      orientation: 'love',
    },
    pity: {
      rite_name: 'The Sitting With',
      act: 'Let yourself not know today. Don\'t reconstruct the story of what happened. Just be in the not-knowing for one day, as if it were a season rather than a problem.',
      invocation: 'This is the between place. I am allowed to be here.',
      textures: ['The ache of having lost something that felt like ground', 'Resistance to not solving', 'A strange spaciousness if you stop rebuilding'],
      bija: null,
      orientation: 'love',
    },
    causality: {
      rite_name: 'The Repetition',
      act: 'Write down the unsaid thing. Then whisper it aloud. Then say it at normal volume. Then say it again. Keep repeating it until it starts to sound strange — until the words lose their grip. When it becomes almost absurd, you\'ve said it enough times.',
      invocation: 'HAM. My voice belongs to the air. The word releases what the silence kept.',
      textures: ['The throat tightening at writing it', 'The strangeness of hearing your own voice', 'The moment the words become just sounds — and something loosens'],
      bija: 'HAM',
      orientation: 'love',
    },
    eternity: {
      rite_name: 'The Turning Toward',
      act: 'There is something you have been looking away from. Locate it: is it an idea that frightens you? A feeling you\'ve been pushing down? A relationship you won\'t examine? A truth about yourself you keep circling? Name the category first. Then look directly at it for five minutes — not to fix it, not to decide. Just to see. Then close your eyes and rest.',
      invocation: 'OM. The untrained mind looks away. This is the training.',
      textures: ['Resistance to even naming the category', 'The nausea or dread of turning toward it', 'The difference between facing and solving'],
      bija: 'OM',
      orientation: 'love',
    },
    unity: {
      rite_name: 'The Belonging',
      act: 'Find one thing made by another human — a chair, a piece of food, a song. Sit with the fact that a person made this for you. Let that person exist in your mind for a moment.',
      invocation: 'AH. I am already part of what exists.',
      textures: ['The isolation feeling less absolute', 'A small warmth at the recognition', 'The separateness softening slightly'],
      bija: 'AH',
      orientation: 'love',
    },
    calamity: {
      rite_name: 'The Bottom',
      act: 'Let yourself be at the bottom today. Don\'t climb. Don\'t explain. Don\'t make it mean something yet. The bottom is solid. You are resting on something real.',
      invocation: 'I have reached the ground. This is not defeat. This is arrival.',
      textures: ['The ache of having tried and fallen', 'Something paradoxically stable at the very bottom', 'The relief of not having further to fall'],
      bija: null,
      orientation: 'love',
    },
    cyclicity: {
      rite_name: 'The First Step',
      act: 'Do one thing today that belongs to the life you want to be living. It can be very small. You don\'t have to feel ready.',
      invocation: 'To run, fall forward. To eat, bite. Take a step. Take a better step.',
      textures: ['The inertia of not-yet', 'Surprise that the step was possible', 'Something that wants to be called hope'],
      bija: null,
      orientation: 'love',
    },
  },

  // ── SYMPATHETIC ──────────────────────────────
  // Racing, tight, urgent — but moving. Redirect the momentum already here.
  sympathetic: {
    entity: {
      rite_name: 'The Planting',
      act: 'Go outside. Press your feet into earth, grass, or stone. Pick up one object from the ground — a stone, a leaf, a stick. Hold it for the next hour. Let it be your anchor.',
      invocation: 'LAM. I grow from where I stand.',
      textures: ['Urgency still buzzing in the chest', 'Something slowing as you hold the object', 'Feet finding the floor beneath the floor'],
      bija: 'LAM',
      orientation: 'love',
    },
    affinity: {
      rite_name: 'The Longing Made Visible',
      act: 'Write down one thing you desire that you\'ve been pretending you don\'t. Don\'t explain it. Don\'t justify it. Name it on paper and let it exist.',
      invocation: 'VAM. My wanting is not a flaw.',
      textures: ['Shame at the naming', 'Something relieved when it\'s written', 'The desire becoming less frantic when witnessed'],
      bija: 'VAM',
      orientation: 'love',
    },
    activity: {
      rite_name: 'The Channel',
      act: 'Take the project you\'re gripping tightest. Do one hour of it with one rule: you cannot control the outcome, only the quality of this hour. Set a timer. Begin.',
      invocation: 'RAM. I work, and I release what I make.',
      textures: ['Resistance to the constraint', 'Surprising freedom once inside it', 'Satisfaction distinct from result'],
      bija: 'RAM',
      orientation: 'love',
    },
    capacity: {
      rite_name: 'The Reaching',
      act: 'Make the contact you\'ve been withholding — a text, a call, a visit, a letter. One sentence. Send it before you edit it twice.',
      invocation: 'YAM. My reaching is not weakness. It is the rite.',
      textures: ['Shaking before', 'Vertigo at send', 'Grief or relief — both are it working'],
      bija: 'YAM',
      orientation: 'love',
    },
    pity: {
      rite_name: 'The False Flames',
      act: 'Write down one lie you have been living as if it were true. Not a belief — a lie. Something that was never true but you have been acting as if it were. Then burn it, tear it, or flush it. Watch it go.',
      invocation: 'The lie is burning. What\'s left is real. Maybe it was happening for you all along.',
      textures: ['The shock of calling it a lie', 'Grief or relief at the naming', 'Something lighter when the smoke clears'],
      bija: null,
      orientation: 'love',
    },
    causality: {
      rite_name: 'The Declaration',
      act: 'Say the unsaid thing to a witness — one person, no preamble, no softening. They don\'t have to respond. Their presence is enough.',
      invocation: 'HAM. My voice belongs in the room.',
      textures: ['Terror before', 'Body shaking during', 'Liberation or grief after — both are it working'],
      bija: 'HAM',
      orientation: 'love',
    },
    eternity: {
      rite_name: 'The Long Arc',
      act: 'Draw a rough timeline of your life — a few years back, now, a few years ahead. Mark where you are. Then place what feels enormous right now somewhere on that line. Notice its size in relation to the whole sweep of your life before and after it.',
      invocation: 'OM. Wide-eyed or squinting: what way of looking at this hurts the least?',
      textures: ['Resistance to perspective', 'Something humbling and relieving at once', 'What felt like the whole sky becoming weather passing through'],
      bija: 'OM',
      orientation: 'love',
    },
    unity: {
      rite_name: 'The Joining',
      act: 'Join something larger than yourself today — a conversation, a gathering, a collective effort. Participate without leading, without fixing, without performing. FOMO steals your light; belonging restores it. Just be a member.',
      invocation: 'AH. I am not separate from this.',
      textures: ['Self-consciousness at entry', 'A softening as you settle', 'Something loosening at the crown'],
      bija: 'AH',
      orientation: 'love',
    },
    calamity: {
      rite_name: 'The Surrender',
      act: 'Write down the thing you cannot control in this situation. Then write: I release my grip on this — not because I don\'t care, but because caring must breathe.',
      invocation: 'Let it come. Let it be. Let it go. Mastery follows the flow.',
      textures: ['The grief of releasing what you were gripping', 'Something the hands feel after they open', 'A different kind of caring that doesn\'t require holding on'],
      bija: null,
      orientation: 'love',
    },
    cyclicity: {
      rite_name: 'The Recommitment',
      act: 'Write down the one thing you keep returning to — the thread that keeps pulling you back. Don\'t justify it. Write it as a statement of fact: This is what I keep coming back to.',
      invocation: 'I am not starting over. I am beginning from here.',
      textures: ['Recognition at the writing', 'Grief mixed with energy', 'The clarity of the one true thing'],
      bija: null,
      orientation: 'love',
    },
  },

  // ── VENTRAL ──────────────────────────────────
  // Open, curious, flowing. The expansive rites — ceremony, play, creation.
  ventral: {
    entity: {
      rite_name: 'The Ceremony of Ground',
      act: 'Set a threshold — a doorway, a line of stones, a piece of tape on the floor. Cross it slowly. Say aloud: I am entering this as myself. Then act from that ground for the rest of the day.',
      invocation: 'LAM. I enter this body. I enter this life.',
      textures: ['The slight absurdity that precedes real ritual', 'Something gathering as you speak', 'A new seriousness without grimness'],
      bija: 'LAM',
      orientation: 'love',
    },
    affinity: {
      rite_name: 'The Altar of Longing',
      act: 'Gather three objects that represent things you love — not things you want, things you already love. Arrange them somewhere you\'ll see them. They are your altar of what you are already made of.',
      invocation: 'VAM. I am worthy of what I love.',
      textures: ['Delight in the gathering', 'Recognition at the arrangement', 'A warmth in the chest that says: this is me'],
      bija: 'VAM',
      orientation: 'love',
    },
    activity: {
      rite_name: 'The Making',
      act: 'Make something today that has no utility — a drawing, a sound, a meal cooked with unusual ingredients, a letter to nobody. Let the making be the whole point. Don\'t judge what you make.',
      invocation: 'RAM. I make because I am alive, not because it is needed.',
      textures: ['Initial self-consciousness', 'Flow when the inner critic quiets', 'Pride or something like it at the end'],
      bija: 'RAM',
      orientation: 'love',
    },
    capacity: {
      rite_name: 'The Current',
      act: 'Do something loving for someone who will not know it was you. A small gift left without a name, a task done invisibly, a kind word sent to someone who can\'t trace it back. Let the love move through you without stopping for credit.',
      invocation: 'YAM. Love moves through me without stopping.',
      textures: ['A slight strangeness at the anonymity', 'Joy in the act itself', 'Fullness that needs no return'],
      bija: 'YAM',
      orientation: 'love',
    },
    pity: {
      rite_name: 'The Threshold Rite',
      act: 'Stand at an actual threshold — a doorway, a shoreline, a hilltop. Say aloud what you are leaving behind. Then step through. Don\'t look back for a count of ten. Drop seeds in the crack. The daffodils come later.',
      invocation: 'I have changed. I don\'t need to carry the proof.',
      textures: ['The slight absurdity', 'Something gathering at the speaking', 'A real difference in how you hold the air after'],
      bija: null,
      orientation: 'love',
    },
    causality: {
      rite_name: 'The Knowing',
      act: 'Write three sentences beginning with "I know…" Not beliefs — things you know in your body, in your lived experience. Feelings are true. Knowing is true. Then read them aloud to yourself or to someone who should hear them.',
      invocation: 'HAM. I speak from what I know, not from what I\'ve been told.',
      textures: ['The distinction between knowing and believing', 'The weight of what you actually know', 'Recognition when the words land in the room'],
      bija: 'HAM',
      orientation: 'love',
    },
    eternity: {
      rite_name: 'The Vision Made',
      act: 'Make something that expresses your current vision of what\'s possible — write it, draw it, paint it, build it in miniature. Don\'t plan what it will look like before you begin. Daydream into the making. What arrives is the vision.',
      invocation: 'OM. I bring what I see in the dark into the light.',
      textures: ['The initial not-knowing', 'The vision arriving through the making', 'Something that now exists that didn\'t before'],
      bija: 'OM',
      orientation: 'love',
    },
    unity: {
      rite_name: 'The Integration',
      act: 'Name one belief you hold about yourself and one that seems to contradict it. Write both. Then write one sentence that holds both at once — not a compromise, a wholeness. Every quality has an opposite. In the middle sits peace.',
      invocation: 'AH. I contain what seems to conflict. This is not confusion. It is depth.',
      textures: ['The mind\'s desire to resolve rather than hold', 'Something expanding when the contradiction is named', 'A truer account of yourself'],
      bija: 'AH',
      orientation: 'love',
    },
    calamity: {
      rite_name: 'The Grief Rite',
      act: 'Find a way to mark this loss — not a performance, a private acknowledgment. A stone placed somewhere, a letter written and burned, a walk in the direction of what was lost. Give the ending its due.',
      invocation: 'This deserved to be held. Now I set it down with care.',
      textures: ['The particular weight of doing this intentionally', 'Tears or stillness — both are the rite', 'Something that knows it was honored'],
      bija: null,
      orientation: 'love',
    },
    cyclicity: {
      rite_name: 'The New Chapter Rite',
      act: 'Mark this beginning. Change one thing in your physical environment — your desk, your morning routine, your route to somewhere. Let the change be a signal to yourself that something is different now.',
      invocation: 'I carry what I have learned. I am not who I was at the beginning. This is the same journey and I am new.',
      textures: ['The pleasure of intention', 'The change feeling larger than its size suggests', 'Something that recognizes itself in the new beginning'],
      bija: null,
      orientation: 'love',
    },
  },

  // ── UNCERTAIN ────────────────────────────────
  // We don't know where they are. Invitational, spacious, minimal-demand.
  // These rites create room for whatever is present to surface.
  uncertain: {
    entity: {
      rite_name: 'The Weighted',
      act: 'Find 3–5 heavy objects — books, stones, water bottles, anything with heft. Lie down on the ground, ideally in sunlight. Place each object on your body where it feels right. Focus on your exhales. Let the weight press you into the earth. When you\'re ready to rise, let the objects topple off you.',
      invocation: 'LAM. The ground holds me. I hold the ground.',
      textures: ['The immediate relief of weight', 'Something settling through exhale by exhale', 'The lightness of rising after being held'],
      bija: 'LAM',
      orientation: 'love',
    },
    affinity: {
      rite_name: 'The Inkwell',
      act: 'Get paper and something to draw with. Without thinking, draw for ten minutes — no subject, no plan, no judgment. Let the hand move before the mind can comment. When the page is full, look at what appeared. Name three things you see — literal or felt. This is the shadow made visible.',
      invocation: 'VAM. What I feel, I can make visible.',
      textures: ['Self-consciousness at the first mark', 'The hand knowing what the mind doesn\'t', 'Recognition at the naming'],
      bija: 'VAM',
      orientation: 'love',
    },
    activity: {
      rite_name: 'The Small Offering',
      act: 'Do one small thing today that you didn\'t have to do — something for someone else, or for a future version of yourself. Say little, do much. Don\'t announce it.',
      invocation: 'RAM. Action can be gentle.',
      textures: ['Slight surprise at how small this can be', 'A quiet satisfaction', 'Nothing to report to anyone'],
      bija: 'RAM',
      orientation: 'love',
    },
    capacity: {
      rite_name: 'The Listening',
      act: 'Listen to someone today — really listen, without planning what to say. When they finish, pause before you respond.',
      invocation: 'YAM. There is room here for what you carry.',
      textures: ['The impulse to speak too soon', 'Something settling when you wait', 'The other person visibly arriving when held'],
      bija: 'YAM',
      orientation: 'love',
    },
    pity: {
      rite_name: 'The Acknowledgment',
      act: 'Write one sentence beginning with "I used to believe…" Don\'t continue it. Let the sentence be complete.',
      invocation: 'Something has shifted. I don\'t have to name it yet.',
      textures: ['The sentence arriving before you expect it', 'Recognition at seeing it written', 'Nothing required beyond the writing'],
      bija: null,
      orientation: 'love',
    },
    causality: {
      rite_name: 'The One True Thing',
      act: 'Say one true thing today that you would normally not say. It can be tiny. It can be to yourself.',
      invocation: 'HAM. Truth needs only one breath to begin.',
      textures: ['The pause before', 'Surprise at how small the ask is', 'Something slightly freer afterward'],
      bija: 'HAM',
      orientation: 'love',
    },
    eternity: {
      rite_name: 'The Inner Eye',
      act: 'Find somewhere quiet. Close your eyes. Ask: what do I already know about this that I haven\'t been trusting? Don\'t rush the answer. If an image, a word, or a feeling arrives — follow it without questioning where it came from. Write or draw what surfaces, however small or strange. The inner vision speaks in small signals. The practice is learning to trust them.',
      invocation: 'OM. What I see in the dark is real. I am learning to trust it again.',
      textures: ['Doubt that anything will arrive', 'Something small surfacing anyway', 'Recognition — you already knew'],
      bija: 'OM',
      orientation: 'love',
    },
    unity: {
      rite_name: 'The Enough',
      act: 'Before you go to sleep, name three things that went well today. Not great — just well. They don\'t have to be yours. They just have to be real.',
      invocation: 'AH. This was a whole day.',
      textures: ['Resistance to sufficiency', 'Something softening at the naming', 'Sleep coming slightly easier'],
      bija: 'AH',
      orientation: 'love',
    },
    calamity: {
      rite_name: 'The Witness',
      act: 'Sit with what has collapsed. Don\'t explain it to anyone today. Don\'t make it useful yet. Let it come. Let it be. Just let it have been real.',
      invocation: 'This happened. It is allowed to have happened.',
      textures: ['The reflex to make meaning too quickly', 'Something dignifying about letting the loss be as large as it was', 'No resolution required today'],
      bija: null,
      orientation: 'love',
    },
    cyclicity: {
      rite_name: 'The Threshold',
      act: 'Write two things: first, one thing that has completed or ended in your life — even if it ended hard. One sentence only. Then, one thing you feel faintly pulled toward beginning. One sentence. Read them back to back. These are the same threshold, seen from either side.',
      invocation: 'What has ended has made room. What is beginning has been waiting.',
      textures: ['Acknowledging that something really has ended', 'The faint pull toward something new', 'The moment of seeing they are related'],
      bija: null,
      orientation: 'love',
    },
  },
};

// ─────────────────────────────────────────────
// CLUE KEYWORD MAPS
// ─────────────────────────────────────────────

export const VAGAL_CLUE_MAP = {
  sympathetic: ['urgent', 'urgency', "can't stop", 'racing', 'tight', 'tense', 'scared', 'fear', 'must', 'control', 'not enough', 'deadline', 'running out', 'anxious', 'anxiety', 'hoarding', 'gripping', 'panicking', 'restless', 'spinning'],
  dorsal:      ['numb', "what's the point", "can't feel", 'flat', 'hopeless', 'frozen', 'heavy', 'shutdown', 'disconnected', 'why bother', 'exhausted', 'collapsed', "don't care", 'giving up', 'pointless'],
  ventral:     ['curious', 'open', 'possible', 'connected', 'enough', 'present', 'playful', 'grateful', 'flowing', 'clear', 'easy', 'spacious', 'calm'],
};

export const BELIEF_CLUE_MAP = {
  scarcity:     ['not enough', 'running out', "can't afford", 'scarce', 'losing', 'hoarding', 'taking', 'mine', 'protect what i have'],
  unworthiness: ["don't deserve", 'not good enough', 'unworthy', 'who am i', 'imposter', 'fraud', "shouldn't", 'not ready', "when i'm better"],
  control:      ['must manage', "can't trust", "don't trust", 'need to control', 'if i let go', 'what if they', 'have to do it myself', 'do everything myself', 'no one else can', "can't let go", 'i have to manage', 'orchestrat'],
  isolation:    ['alone', 'no one understands', 'by myself', 'do it alone', "can't ask", "haven't talked", 'reaching out', "haven't reached", 'two years', 'distance', 'brother', 'sister', 'parent'],
  silence:      ["can't say", "won't be heard", 'stay quiet', "doesn't matter", 'unsaid', 'kept quiet', 'never told', 'bite my tongue'],
  blindness:    ["can't look", 'avoiding', 'not ready', "don't want to see", 'unclear', 'turning away', 'looking away', 'ignoring'],
  separation:   ['separate', 'not part of', "don't belong", 'outside', 'disconnected from everything', 'no place', 'not one of them'],
};

// TODO: QUALITY_CLUE_MAP — Chef, this is yours to fill in.
//
// These keyword arrays map what a Seeker says to which Quality vector
// they seem to be inhabiting. This is the Octave's fingerprint in language.
// You know this territory better than anyone.
//
// Each quality has an array of words/phrases that signal it.
// When a person says "I don't know what I want to do with my life" → entity
// When they say "everything I built just fell apart" → calamity
// ...and so on.
//
// The inferQuality() function uses these to sense where on the octave
// a Seeker is speaking from — without ever naming it to them.
//
// Structure: { quality_name: ['phrase', 'phrase', ...] }
// File: api/engine.js, below this comment block.

export const QUALITY_CLUE_MAP = {
  entity:    ['who am i', 'what am i', 'where do i start', 'beginning', "don't know where i am", 'lost myself', 'no ground', 'who is this', 'starting from zero'],
  affinity:  ['what do i want', 'what do i feel', 'drawn to', 'connection', 'attraction', 'resonance', 'this feels right', 'something is calling', 'longing'],
  activity:  ['need to make this happen', 'working hard', 'trying so hard', 'doing everything i can', "can't stop moving", 'grinding', 'willpower', 'effort', 'pushing'],
  pity:      ["thought i knew", "i was wrong", 'everything changed', 'not what i thought', 'separate now', 'left behind', 'gap', 'missing something', "can't go back"],
  capacity:  ['open up', 'receive', 'let it in', "can't take it in", 'too much love', 'how do i accept', 'letting go of armor', 'softening'],
  causality: ['finding my voice', 'need to speak', "can't express", 'how do i say this', 'my truth', 'what i need to say', 'communicate', 'the right words'],
  eternity:  ['i can see the pattern', 'something bigger', 'connected to something larger', 'the long view', 'zoom out', 'vision', 'it all makes sense now', 'i know where this goes'],
  unity:     ['i understand', 'it all comes together', 'wholeness', 'integration', 'i know what i need to do', 'clarity', 'complete picture', 'all in'],
  calamity:  ['falling apart', 'collapsed', 'surrender', 'i give up', 'everything is gone', 'the bottom', 'hit rock bottom', "don't know anything anymore", 'crisis'],
  cyclicity: ['starting over', 'full circle', 'back to the beginning', 'where do i go from here', 'what comes next', 'completed something', 'a new chapter', 'wandering'],
};

// ─────────────────────────────────────────────
// INFERENCE FUNCTIONS
// ─────────────────────────────────────────────

function scoreText(text, keywords) {
  const t = text.toLowerCase();
  return keywords.filter(k => t.includes(k)).length;
}

export function inferVagalState(text) {
  const scores = Object.entries(VAGAL_CLUE_MAP).map(([state, kws]) => ({
    state,
    score: scoreText(text, kws),
  }));
  scores.sort((a, b) => b.score - a.score);
  const top = scores[0];
  const confidence = top.score === 0 ? 'low' : top.score < 3 ? 'medium' : 'high';
  const mixed = scores[0].score > 0 && scores[1].score > 0 && scores[1].score >= scores[0].score - 1;
  return { probable: mixed ? 'mixed' : top.state, confidence, scores };
}

export function inferBelief(text) {
  const scores = Object.entries(BELIEF_CLUE_MAP).map(([pattern, kws]) => ({
    pattern,
    score: scoreText(text, kws),
  }));
  scores.sort((a, b) => b.score - a.score);
  const top = scores[0];
  if (top.score === 0) return { pattern: null, confidence: 'low' };
  return {
    pattern: top.pattern,
    confidence: top.score >= 2 ? 'high' : 'medium',
    meta: BELIEFS[top.pattern],
  };
}

export function inferQuality(text) {
  const scores = Object.entries(QUALITY_CLUE_MAP).map(([quality, kws]) => ({
    quality,
    score: scoreText(text, kws),
  }));
  scores.sort((a, b) => b.score - a.score);
  const top = scores[0];
  if (top.score === 0) return { quality: null, confidence: 'low' };
  const octaveNode = Object.values(OCTAVE).find(n => n.quality === top.quality);
  return {
    quality: top.quality,
    confidence: top.score >= 2 ? 'high' : 'medium',
    seeker_language: octaveNode?.seeker_language || null,
    is_shock: octaveNode?.shock || false,
  };
}

// ─────────────────────────────────────────────
// INFERENCE DISPATCHER
// Routes to semantic (LLM) or keyword inference based on feature flag.
// Both paths return the same shape — callers don't know which ran.
// ─────────────────────────────────────────────

function keywordInfer(text) {
  const vagal   = inferVagalState(text);
  const belief  = inferBelief(text);
  const quality = inferQuality(text);
  return {
    vagal:  { probable: vagal.probable, confidence: vagal.confidence },
    belief: { pattern: belief.pattern, confidence: belief.confidence, meta: belief.meta },
    quality: { quality: quality.quality, confidence: quality.confidence, is_shock: quality.is_shock, seeker_language: quality.seeker_language },
  };
}

export async function infer(text) {
  if (process.env.SEMANTIC_INFERENCE === 'true') {
    const mode = (process.env.SEMANTIC_INFERENCE_MODE || 'llm').toLowerCase();
    try {
      let result;
      if (mode === 'embeddings') {
        result = await (await import('./semantic-embeddings.js')).inferSemanticsEmbeddings(text);
        // For embeddings mode, we cannot derive affect; use neutral fallback
        result.affect = { valence: 0, arousal: 0, gloss: 'neutral', confidence: 'low', reasoning: 'embeddings mode; no affect inference' };
      } else {
        // Parallel LLM calls for semantics and affect
        const [semantics, affect] = await Promise.all([
          (await import('./infer.js')).inferSemantics(text),
          (await import('./infer.js')).inferAffect(text),
        ]);
        result = { ...semantics, affect: affect.affect };

        // Validation: clamp valence/arousal to [-1.0, 1.0]
        const origV = result.affect.valence;
        const origA = result.affect.arousal;
        let clamped = false;
        if (origV < -1.0 || origV > 1.0) {
          result.affect.valence = Math.max(-1.0, Math.min(1.0, origV));
          clamped = true;
        }
        if (origA < -1.0 || origA > 1.0) {
          result.affect.arousal = Math.max(-1.0, Math.min(1.0, origA));
          clamped = true;
        }
        if (clamped) {
          result.affect.confidence = 'low';
          result.affect.reasoning = `(clamped) ${result.affect.reasoning}`;
        }

        // Enforce gloss length ≤ 7 words
        if (result.affect.gloss) {
          const words = result.affect.gloss.trim().split(/\s+/);
          if (words.length > 7) {
            result.affect.gloss = words.slice(0, 7).join(' ');
            result.affect.confidence = 'low';
            result.affect.reasoning = `(truncated gloss) ${result.affect.reasoning}`;
          }
        }
      }

      // Attach seeker_language from OCTAVE for the quality node
      if (result.quality.quality) {
        const node = Object.values(OCTAVE).find(n => n.quality === result.quality.quality);
        result.quality.seeker_language = node?.seeker_language || null;
      }
      return result;
    } catch (err) {
      const is402 = err?.status === 402 || err?.statusCode === 402;
      console.error(JSON.stringify({
        event: 'semantic_inference_fallback',
        reason: is402 ? 'payment_required' : 'error',
        error: err?.message,
      }));
      return keywordInfer(text);
    }
  }

  // SEMANTIC_INFERENCE off: static neutral affect
  const keywordResult = keywordInfer(text);
  keywordResult.affect = { valence: 0, arousal: 0, gloss: 'neutral', confidence: 'low', reasoning: 'inference disabled' };
  return keywordResult;
}

// ─────────────────────────────────────────────
// LOVE / FEAR AUDIT
// Love = toward / propulsion. Fear = away / repulsion.
// Post-prescription gate: ensures the rite we offer opens, not closes.
// ─────────────────────────────────────────────

const LOVE_MARKERS = ['receive', 'open', 'reach', 'create', 'invite', 'welcome', 'toward', 'give', 'let in', 'embrace', 'worthy', 'enough', 'belong', 'connect', 'surrender', 'witness', 'declare', 'release'];
const FEAR_MARKERS = ['avoid', 'escape', 'protect', 'defend', 'stop', 'prevent', 'hide', 'safe from', 'keep away', 'block', 'guard', 'resist'];

export function auditLoveFear(rite) {
  if (!rite) return { orientation: 'unknown', love_score: 0, fear_score: 0 };
  const text = [rite.rite_name, rite.act, rite.invocation].join(' ').toLowerCase();
  const love_score = LOVE_MARKERS.filter(w => text.includes(w)).length;
  const fear_score = FEAR_MARKERS.filter(w => text.includes(w)).length;
  const orientation = fear_score > love_score ? 'fear' : love_score > 0 ? 'love' : 'neutral';
  return { orientation, love_score, fear_score };
}

// ─────────────────────────────────────────────
// OPENING QUESTIONS
// ─────────────────────────────────────────────

export const OPENING_QUESTIONS = [
  "What's the thing you keep almost doing, but not quite?",
  "Where in your body do you feel the most resistance right now?",
  "What story are you telling yourself about why this isn't moving?",
  "If you could be honest with yourself about one thing today, what would it be?",
  "What are you holding that you haven't said out loud yet?",
  "What are you carrying that was never yours to begin with?",
  "What would you do differently if you had already died once?",
  "What are you saving yourself for?",
  "What are you trying to hold still that already wants to move?",
  "What would you ask if you knew the answer didn't matter?",
  "What would love do here, if you got out of the way?",
  "What are you standing at the edge of?",
  "What question should I be asking?",
];

// Closing dedications — one per opening question, same index.
// Spoken after the witness, before the session closes.
// Audio tags are stripped for display; passed raw to Fish.audio TTS.
export const CLOSING_DEDICATIONS = [
  "[low warmth, a smile of release] Go do the thing. [pause] It was always time.",
  "[warm breath, a smile in the sending off] Carry that body into the day. [short pause] It knows the way.",
  "[quiet delight, a smile of knowing] Walk out of the story now. [pause] You can.",
  "[warmth, certain, a quiet smile] Be that honest. [short pause] Not later. Now.",
  "[soft warmth, releasing with love] Go lighter than you came. [pause] You said the thing.",
  "[low voice, warm authority, a smile beneath it] Leave it here. [pause] Walk free.",
  "[hushed and warm, a fierce tenderness] Be like that now. [pause] You have died. You know how.",
  "[willing exuberance, wide open] Spend yourself. [pause] This is what you were saving for.",
  "[warm exhale, releasing into motion, a smile of trust] Let it take you somewhere. [short pause] Trust that.",
  "[soft delight, open and easy] Go without the answer. [pause] See what finds you.",
  "[warmth, certain, a smile] Get out of the way. [pause] Love knows.",
  "[low voice, warm and unhurried, a smile beneath the words] Step. [pause] The other side is real.",
  "[pensive warmth, a smile in it] Ask it everywhere you go. [pause] Keep asking.",
];

export function getClosingDedication(openingQuestion) {
  const i = OPENING_QUESTIONS.indexOf(openingQuestion);
  return i >= 0 ? CLOSING_DEDICATIONS[i] : null;
}

export function chooseOpeningQuestion(context = {}) {
  if (context.hint === 'body')   return OPENING_QUESTIONS[1];
  if (context.hint === 'story')  return OPENING_QUESTIONS[2];
  if (context.hint === 'honest') return OPENING_QUESTIONS[3];
  if (context.hint === 'unsaid') return OPENING_QUESTIONS[4];
  const pool = context.last_question
    ? OPENING_QUESTIONS.filter((q) => q !== context.last_question)
    : [...OPENING_QUESTIONS];
  if (Number.isInteger(context.session_count) && pool.length) {
    return pool[context.session_count % pool.length];
  }
  if (pool.length) return pool[0];
  return OPENING_QUESTIONS[0];
}

// ─────────────────────────────────────────────
// ORACLE FLAVOR DRAWS
// ─────────────────────────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIVINATION_MAPS = {
  tarot: loadOracleMap(path.join(__dirname, 'data', 'tarot-octave-map.json')),
  iching: loadOracleMap(path.join(__dirname, 'data', 'iching-octave-map.json')),
};

function loadOracleMap(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

export function drawDivinationSource(divinationSource, quality) {
  if (!divinationSource || !quality) return null;
  const key = String(divinationSource).toLowerCase();
  const map = DIVINATION_MAPS[key];
  if (!Array.isArray(map)) return null;

  const matches = map.filter((entry) => entry.quality === quality);
  if (!matches.length) return null;
  const choice = matches[randomInt(matches.length)];

  if (key === 'tarot') {
    return {
      source: 'tarot',
      card: { name: choice.name, suit: choice.suit, rank: choice.rank },
      quality: choice.quality,
      score: choice.score,
    };
  }

  if (key === 'iching') {
    return {
      source: 'iching',
      hexagram: { number: choice.number, name: choice.name },
      quality: choice.quality,
      score: choice.score,
    };
  }

  return null;
}

// ─────────────────────────────────────────────
// PRESCRIPTION BUILDER
// Combines vagal + belief + quality inference into a rite.
// Audits for love/fear orientation before returning.
// ─────────────────────────────────────────────

export function buildPrescription(vagalState, belief, quality) {
  // mixed vagal → sympathetic (mixed states are usually more activated than shut down)
  // unknown key → uncertain
  const vagalKey = vagalState === 'mixed' ? 'sympathetic'
    : RITES[vagalState] ? vagalState
    : 'uncertain';

  const qualityKey = quality?.quality || 'entity';

  const rite = RITES[vagalKey]?.[qualityKey]
    ?? RITES.uncertain?.[qualityKey]
    ?? RITES.dorsal.entity;

  const audit = auditLoveFear(rite);
  const flagged = audit.orientation === 'fear';

  return {
    vagal_state: vagalState,
    quality: quality?.quality || null,
    quality_is_shock: quality?.is_shock || false,
    limiting_belief: belief?.pattern || null,
    rite,
    love_fear_audit: audit,
    flagged,
    note: flagged
      ? `⚠ Rite orientation flagged as fear-facing. Review before presenting to Seeker.`
      : null,
  };
}
