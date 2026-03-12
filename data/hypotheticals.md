# Phase 1 Test Data — Labeled Examples

**Status:** Populated
**Date:** 2026-03-11
**Purpose:** Training and evaluation data for MEATAPI inference engine

This document provides hand-labeled test sets for Phase 1 development.
Each section covers a different inference target.

---

## A. Vagal State Test Set (20 items)

Goal: 20 hand-labeled texts covering all 4 vagal states (ventral, sympathetic, dorsal, mixed).

### Ventral Vagal (Safe, Connected, Present)

```
id: VAGAL_01
label: ventral
text: "I feel really good about where this is going. Like, I'm not worried about the outcome—I'm just curious to see what happens next."
notes: "Calm curiosity, no urgency"
```

```
id: VAGAL_02
label: ventral
text: "Sitting with my friend, not even talking. Just being there. It's enough."
notes: "Social engagement, safety in connection"
```

```
id: VAGAL_03
label: ventral
text: "I took a breath and realized—oh, I'm actually okay right now. This moment is fine."
notes: "Present-moment awareness, grounding"
```

```
id: VAGAL_04
label: ventral
text: "The sunset caught me off guard. I just stopped and watched. No agenda, no rush."
notes: "Awe, natural presence, absorption"
```

```
id: VAGAL_05
label: ventral
text: "We figured it out together. It wasn't about being right, just... solving it. And it felt easy."
notes: "Collaborative flow, co-regulation"
```

### Sympathetic (Fight/Flight, Mobilized, Anxious)

```
id: VAGAL_06
label: sympathetic
text: "I can't sit still. My heart's racing and I feel like something bad is about to happen, I just don't know what."
notes: "Free-floating anxiety, hypervigilance"
```

```
id: VAGAL_07
label: sympathetic
text: "They need to understand this NOW. I've said it five times and they're still not getting it."
notes: "Fight response, frustration, urgency"
```

```
id: VAGAL_08
label: sympathetic
text: "I need to get out of here. Everything feels too loud, too close, too much."
notes: "Flight response, overwhelm, escape urge"
```

```
id: VAGAL_09
label: sympathetic
text: "What if I'm wrong? What if this all falls apart? I can't stop thinking about everything that could go wrong."
notes: "Catastrophizing, racing thoughts"
```

```
id: VAGAL_10
label: sympathetic
text: "I'm working on three things at once and I keep checking my phone because I'm scared I'm missing something."
notes: "Hypervigilance, scattered attention, FOMO"
```

### Dorsal Vagal (Shutdown, Collapse, Numb)

```
id: VAGAL_11
label: dorsal
text: "I don't even want to get out of bed. What's the point? Nothing changes anyway."
notes: "Hopelessness, learned helplessness"
```

```
id: VAGAL_12
label: dorsal
text: "I feel like I'm watching my life from far away. Like none of this is really happening to me."
notes: "Dissociation, derealization"
```

```
id: VAGAL_13
label: dorsal
text: "Someone asked how I was and I said 'fine' because I don't have the energy to explain what's actually going on."
notes: "Withdrawal, low energy, masking"
```

```
id: VAGAL_14
label: dorsal
text: "I've been scrolling for hours. I don't even remember what I was looking at. I just can't stop."
notes: "Numb dissociation, default mode trap"
```

```
id: VAGAL_15
label: dorsal
text: "It's like I'm frozen. I know I should do something but I just... can't move."
notes: "Freeze response, functional freeze"
```

### Mixed (Oscillating, Conflicted, Between States)

```
id: VAGAL_16
label: mixed
text: "Part of me wants to reach out and connect, but another part wants to run away and hide. I feel both at the same time."
notes: "Ventral-dorsal oscillation, approach-avoidance"
```

```
id: VAGAL_17
label: mixed
text: "I'm exhausted but I can't sleep. My body's tired but my mind won't shut off."
notes: "Dorsal exhaustion + sympathetic activation"
```

```
id: VAGAL_18
label: mixed
text: "I feel calm on the surface but underneath there's this tightness I can't shake. Like I'm waiting for the other shoe to drop."
notes: "Vagal brake with sympathetic undertone"
```

```
id: VAGAL_19
label: mixed
text: "I laughed at the joke but it felt hollow. Like the expression didn't match how I actually felt inside."
notes: "Social masking, incongruent affect"
```

```
id: VAGAL_20
label: mixed
text: "I'm angry and sad and numb all at once. I don't even know which feeling is real."
notes: "Multiple states overlapping, emotional flooding"
```

---

## B. Belief Pattern Test Set (20 items)

Goal: 20 hand-labeled texts covering the 7 limiting belief patterns plus null (no dominant pattern).

### Scarcity (Not Enough)

```
id: BELIEF_01
label: scarcity
text: "There's never enough time. I'm always behind, always rushing, trying to catch up to something I can't even name."
notes: "Temporal scarcity, chronic time pressure"
```

```
id: BELIEF_02
label: scarcity
text: "If I spend this money, I might need it later. Better to hold onto it just in case."
notes: "Resource scarcity, fear of lack"
```

```
id: BELIEF_03
label: scarcity
text: "There's only so much love to go around. If someone else gets more, I get less."
notes: "Relational scarcity, zero-sum thinking"
```

```
id: BELIEF_04
label: scarcity
text: "I need to grab opportunities before they're gone. Everything worth having is running out."
notes: "Opportunity scarcity, FOMO as belief"
```

### Unworthiness (Not Good Enough)

```
id: BELIEF_05
label: unworthiness
text: "Who am I to want that? People like me don't get things like that."
notes: "Self-negation, class/status shame"
```

```
id: BELIEF_06
label: unworthiness
text: "They only said yes because they felt sorry for me. It's not because I actually deserve it."
notes: "Discounting praise, imposter syndrome"
```

```
id: BELIEF_07
label: unworthiness
text: "I should be better by now. Everyone else has it figured out and I'm still struggling with basics."
notes: "Comparative shame, self-judgment"
```

```
id: BELIEF_08
label: unworthiness
text: "If they really knew me, they wouldn't like me. I have to hide the real parts."
notes: "Defectiveness belief, conditional acceptance"
```

### Control (Must Manage Outcomes)

```
id: BELIEF_09
label: control
text: "If I don't plan every detail, something will go wrong. I can't trust things to work out on their own."
notes: "Planning compulsion, distrust of emergence"
```

```
id: BELIEF_10
label: control
text: "I need to know what's going to happen. Uncertainty feels dangerous."
notes: "Intolerance of ambiguity, prediction need"
```

```
id: BELIEF_11
label: control
text: "They made a choice I wouldn't have made and now I'm anxious about what that means for me."
notes: "Other-control anxiety, external locus"
```

### Isolation (Alone and Disconnected)

```
id: BELIEF_12
label: isolation
text: "No one really gets it. I've tried to explain, but they just nod and change the subject."
notes: "Communication gap, felt separateness"
```

```
id: BELIEF_13
label: isolation
text: "I'm on my own. That's just how it is. Asking for help feels like admitting failure."
notes: "Self-reliance as armor, help as weakness"
```

```
id: BELIEF_14
label: isolation
text: "Even in a crowd, I feel like I'm watching from outside. Everyone else is connected but me."
notes: "Social exclusion belief, outsider identity"
```

### Silence (Voice Suppressed)

```
id: BELIEF_15
label: silence
text: "I have something to say, but it's probably not important. Better to stay quiet."
notes: "Self-silencing, minimized voice"
```

```
id: BELIEF_16
label: silence
text: "Every time I speak up, it goes badly. Safer to keep my thoughts to myself."
notes: "Learned silence, punished expression"
```

### Blindness (Cannot See / Refusing to See)

```
id: BELIEF_17
label: blindness
text: "I don't want to think about that. Some things are better left alone."
notes: "Intentional avoidance, willful blindness"
```

```
id: BELIEF_18
label: blindness
text: "I'm sure it's fine. I don't need to check. Everything always works out."
notes: "Pollyanna avoidance, denial mechanism"
```

### Separation (Fragmented from Self / Others)

```
id: BELIEF_19
label: separation
text: "I don't know who I am anymore. Like I've been playing roles so long I forgot what's real."
notes: "Identity fragmentation, self-alienation"
```

```
id: BELIEF_20
label: separation
text: "That happened to me, but it doesn't feel like it was really me. More like a story I heard about someone else."
notes: "Self-distancing, narrative dissociation"
```

---

## C. Octave Position Narratives (10 items)

Goal: 10 short narratives, one per octave quality. These describe lived experience from the perspective of each step in the Octave of Evolution.

```
id: OCTAVE_01
label: entity
text: "I'm just sitting here. Not trying to do anything or be anything. Just feeling the ground beneath me, the weight of my body. I am here. That's enough."
notes: "Step 1 - Ground. The beginning. Presence without agenda. Entity as pure being."
```

```
id: OCTAVE_02
label: affinity
text: "I saw them across the room and something moved. Not a thought—a pull. Like gravity but softer. I wanted to be closer. To know. To feel the shape of their presence next to mine."
notes: "Step 2 - Affinity. The first movement toward. Connection as felt sense, not concept."
```

```
id: OCTAVE_03
label: activity
text: "I'm building something. I don't know what it is yet, but the energy is clear—move, make, shape. My hands are working and I'm not overthinking it. The doing itself is the point."
notes: "Step 3 - Willpower. The fire of creation. Action arising from desire, not obligation."
```

```
id: OCTAVE_04
label: capacity
text: "I'm listening. Not waiting for my turn to speak—actually listening. There's a space in me that can hold what they're saying. I don't need to fix it or change it. I can just be with it."
notes: "Step 4 - Love. The expansion of capacity. Holding space without collapsing."
```

```
id: OCTAVE_05
label: pity
text: "Everything I thought was solid just cracked. I'm not who I believed I was. The story fell apart and underneath there's just... confusion. A gap where certainty used to be. It hurts, but I can't look away."
notes: "Break 4/5 - Shock. The disruption. Pity as the gap between what was and what is."
```

```
id: OCTAVE_06
label: causality
text: "I can see it now—the chain of events, the ripples. What I said then became what we're living now. Not as blame, just as recognition. Every gesture echoes. I want to sing something true into the pattern."
notes: "Step 5 - Song. Causality as creative power. The voice that shapes what comes next."
```

```
id: OCTAVE_07
label: eternity
text: "For a moment, time stopped. I wasn't thinking about yesterday or tomorrow—just this. And in this, I could see further than I ever have. The pattern behind the pattern. The choice that keeps choosing itself."
notes: "Step 6 - Intuition. The eternal now. Vision arising from stillness."
```

```
id: OCTAVE_08
label: unity
text: "There's no separation between me and what I'm looking at. The observer and observed are the same thing looking at itself. I'm not separate from the love I'm feeling—it's all one movement."
notes: "Step 7 - Unity. The dissolution of boundaries. Knowing without knower-known split."
```

```
id: OCTAVE_09
label: calamity
text: "I'm falling and there's nothing to hold onto. Not in a bad way—just in a real way. The structures I built my identity on are dissolving. I don't know who I am without them. Maybe that's the point."
notes: "Crisis 7/8 - Collapse. Calamity as transformation. Surrender of the known self."
```

```
id: OCTAVE_10
label: cyclicity
text: "I'm back where I started, but different. The same ground, but now I see it. The circle closes and opens at once. I've been here before and I'll be here again, each time more fully myself."
notes: "Step 8/0 - Reunion. The spiral returns. Cyclicity as completion that begins again."
```

---

## D. Neutral / False-Positive Set (10 items)

Goal: Neutral texts that should return low confidence for belief/vagal/quality detection. These are mundane, factual, or non-emotional statements that shouldn't trigger strong pattern matching.

```
id: NEUTRAL_01
text: "The meeting is scheduled for 3pm in conference room B. Please bring your quarterly reports."
notes: "Logistical, no emotional content"
```

```
id: NEUTRAL_02
text: "I need to pick up milk and bread on the way home. The store closes at 9."
notes: "Routine task, no pattern activation"
```

```
id: NEUTRAL_03
text: "The weather forecast says rain tomorrow with a high of 62 degrees."
notes: "Informational, no affective signal"
```

```
id: NEUTRAL_04
text: "My flight number is UA 847. It departs from terminal 2, gate C14."
notes: "Travel data, non-psychological"
```

```
id: NEUTRAL_05
text: "The recipe calls for two cups of flour and one teaspoon of salt. Mix until combined."
notes: "Procedural, instructional language"
```

```
id: NEUTRAL_06
text: "I finished reading the report. It was about 40 pages with several charts."
notes: "Factual summary, minimal interpretation"
```

```
id: NEUTRAL_07
text: "The car needs an oil change. I should schedule that for next week."
notes: "Maintenance task, no urgency or distress"
```

```
id: NEUTRAL_08
text: "The train arrives at 7:15 and the connection leaves at 7:45 from platform 3."
notes: "Schedule information, temporal but not temporal scarcity"
```

```
id: NEUTRAL_09
text: "I'll be working from home on Thursday. Let me know if you need anything."
notes: "Routine communication, neutral tone"
```

```
id: NEUTRAL_10
text: "The document is saved in the shared folder under 'Projects/2026/Q1'."
notes: "File location, purely informational"
```

---

## Notes on Usage

**For Phase 1 Development:**
- Use vagal state labels to train `inference/vagal.js`
- Use belief pattern labels to train `inference/belief.js`
- Use octave narratives to train `inference/octave.js`
- Use neutral set to calibrate confidence thresholds and reduce false positives

**Labeling Guidelines:**
- Vagal states: Focus on somatic markers (breath, tension, energy, movement)
- Belief patterns: Focus on underlying assumptions about self/world/other
- Octave positions: Focus on existential theme and developmental stage
- Mixed states: Assign when multiple patterns present with similar intensity

**Expanding the Set:**
- Aim for 50+ items per category for robust training
- Add edge cases (near-misses, subtle presentations)
- Include cultural and linguistic diversity in phrasing

---

**Last updated:** 2026-03-11
**Contributors:** Chef + Worfeus
