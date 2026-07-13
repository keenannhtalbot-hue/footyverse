// Authored content density for the youth arc.
// Categories: school, life, football, funny, rare.
// weight: relative selection weight within an eligible pool.
// cooldownQuarters: minimum quarters between repeats of the same event.
// once: if true, the event can only ever fire a single time for a player.
// effects: { stats:{}, hidden:{}, relationship:{ who, dims:{} } }
// choices (optional): [{ id, label, effects }] — when present the UI must
// let the player pick one; eventEngine applies the chosen branch's effects.

export const EVENTS = [
  // --- school (ages 5-7, 20 events) ---
  {
    id: 'first_day_jitters',
    category: 'school',
    weight: 3,
    minAge: 5,
    maxAge: 6,
    cooldownQuarters: 99,
    once: true,
    text: '{name} was nervous on the first day of school but made it through with a new friend.',
    effects: { hidden: { confidence: 2 } },
  },
  {
    id: 'spelling_bee',
    category: 'school',
    weight: 2,
    minAge: 6,
    maxAge: 11,
    cooldownQuarters: 4,
    text: '{name} entered the class spelling bee.',
    choices: [
      { id: 'study', label: 'Study hard beforehand', effects: { hidden: { workEthic: 2 }, school: 2 } },
      { id: 'wing_it', label: 'Wing it', effects: { hidden: { confidence: 1 }, school: -1 } },
    ],
  },
  {
    id: 'group_project',
    category: 'school',
    weight: 2,
    minAge: 6,
    maxAge: 14,
    cooldownQuarters: 3,
    text: '{name} was assigned a group project with classmates.',

    choices: [
    { id: 'lead', label: "Take the lead and organise the work", effects: {"hidden": {"workEthic": 2}} },
    { id: 'support', label: "Help quietly where needed", effects: {"hidden": {"workEthic": 1}} }
  ],    effects: { hidden: { workEthic: 1 }, school: 1 },
  },
  {
    id: 'school_sports_day',
    category: 'school',
    weight: 2,
    minAge: 6,
    maxAge: 12,
    cooldownQuarters: 4,
    text: 'School sports day arrived, full of races and relays.',

    choices: [
    { id: 'try_hard', label: "Try to win every race", effects: {"stats": {"pace": 1}, "hidden": {"fatigue": 3}} },
    { id: 'help_friend', label: "Help a struggling friend finish", effects: {"hidden": {"confidence": 2}} }
  ],    effects: { stats: { pace: 1 }, hidden: { confidence: 1 } },
  },
  {
    id: 'report_card',
    category: 'school',
    weight: 2,
    minAge: 6,
    maxAge: 16,
    cooldownQuarters: 4,
    text: '{name} brought home a report card.',

    choices: [
    { id: 'celebrate', label: "Celebrate the good grades at home", effects: {"hidden": {"workEthic": 1, "confidence": 1}} },
    { id: 'set_goals', label: "Set goals for next term", effects: {"hidden": {"workEthic": 2}} }
  ],    effects: { hidden: { workEthic: 1 } },
  },

  // --- life (all ages) ---
  {
    id: 'family_moves_house',
    category: 'life',
    weight: 1,
    minAge: 5,
    maxAge: 16,
    cooldownQuarters: 99,
    text: "{name}'s family moved to a new house, close to a different pitch.",
    effects: { hidden: { confidence: -1 } },
  },
  {
    id: 'sibling_born',
    category: 'life',
    weight: 1,
    minAge: 5,
    maxAge: 12,
    cooldownQuarters: 99,
    once: true,
    text: '{name} became a big sibling.',

    choices: [
    { id: 'help_care', label: "Help out with small jobs", effects: {"hidden": {"workEthic": 2}} },
    { id: 'feel_left_out', label: "Feel left out for a while", effects: {"hidden": {"confidence": -1}} }
  ],    effects: { hidden: { confidence: 1 } },
  },
  {
    id: 'pet_adopted',
    category: 'life',
    weight: 2,
    minAge: 5,
    maxAge: 16,
    cooldownQuarters: 8,
    text: 'The family adopted a pet, and {name} helps look after it.',

    choices: [
    { id: 'name_pet', label: "Choose a name and a corner of the room", effects: {"hidden": {"confidence": 1}} },
    { id: 'share_duties', label: "Share the pet chores with the family", effects: {"hidden": {"workEthic": 1}} }
  ],    effects: { hidden: { fatigue: 2, confidence: 1 } },
  },
  {
    id: 'allowance_negotiation',
    category: 'life',
    weight: 2,
    minAge: 7,
    maxAge: 16,
    cooldownQuarters: 6,
    text: '{name} asked for a bigger allowance for boots and gear.',
    choices: [
      { id: 'chores', label: 'Offer to do more chores', effects: { hidden: { workEthic: 2 } } },
      { id: 'push', label: 'Just ask directly', effects: { hidden: { confidence: 1 } } },
    ],
  },
  {
    id: 'minor_bike_accident',
    category: 'life',
    weight: 1,
    minAge: 6,
    maxAge: 14,
    cooldownQuarters: 6,
    text: '{name} took a spill off a bike and scraped a knee.',

    choices: [
    { id: 'shake_off', label: "Shake it off and ride again", effects: {"hidden": {"confidence": 1}} },
    { id: 'head_home', label: "Head home early to check the graze", effects: {"hidden": {"fatigue": 2, "confidence": -1}} }
  ],    effects: { hidden: { fatigue: 4 } },
  },

  // --- football (requires club) ---
  {
    id: 'scouted_local_coach',
    category: 'football',
    weight: 2,
    minAge: 6,
    maxAge: 8,
    cooldownQuarters: 99,
    once: true,
    text: 'A local coach noticed {name} playing in the park and mentioned trying out for a club.',

    choices: [
    { id: 'sign_up', label: "Sign up for the trial", effects: {"hidden": {"confidence": 2}} },
    { id: 'watch_first', label: "Watch a session before committing", effects: {} }
  ],    effects: { hidden: { confidence: 2 } },
  },
  {
    id: 'muddy_pitch_match',
    category: 'football',
    weight: 3,
    minAge: 6,
    maxAge: 16,
    cooldownQuarters: 2,
    requiresClub: true,
    text: "Training was moved to a waterlogged pitch, testing everyone's footing.",
    effects: { stats: { physical: 1 }, hidden: { fatigue: 6 } },
  },
  {
    id: 'trialist_day',
    category: 'football',
    weight: 2,
    minAge: 6,
    maxAge: 10,
    cooldownQuarters: 4,
    requiresClub: true,
    text: 'A trialist joined training for the week, pushing everyone to work harder.',

    choices: [
    { id: 'compete', label: "Compete head-to-head with the trialist", effects: {"hidden": {"workEthic": 2}} },
    { id: 'support', label: "Welcome the trialist and pass them the ball", effects: {"hidden": {"confidence": 1}} }
  ],    effects: { hidden: { workEthic: 1 } },
  },
  {
    id: 'teammate_conflict',
    category: 'football',
    weight: 2,
    minAge: 7,
    maxAge: 16,
    cooldownQuarters: 5,
    requiresClub: true,
    text: 'A disagreement broke out with a teammate over who should take set pieces.',
    choices: [
      { id: 'talk', label: 'Talk it out calmly', effects: { relationship: { who: 'teammate', dims: { trust: 3 } } } },
      { id: 'ignore', label: 'Let it go quietly', effects: { hidden: { confidence: -1 } } },
    ],
  },
  {
    id: 'coach_praises_effort',
    category: 'football',
    weight: 2,
    minAge: 6,
    maxAge: 16,
    cooldownQuarters: 3,
    requiresClub: true,
    text: 'The coach praised {name} in front of the whole squad for effort in training.',

    choices: [
    { id: 'accept', label: "Take the praise with a nod", effects: {"hidden": {"confidence": 2}} },
    { id: 'aim_higher', label: "Resolve to earn even more praise", effects: {"hidden": {"workEthic": 2}} }
  ],    effects: { hidden: { confidence: 2 }, relationship: { who: 'coach', dims: { respect: 2 } } },
  },
  {
    id: 'lost_final_heartbreak',
    category: 'football',
    weight: 1,
    minAge: 7,
    maxAge: 16,
    cooldownQuarters: 6,
    requiresClub: true,
    text: 'The team lost a cup final on penalties. It stung for days.',

    choices: [
    { id: 'analyse', label: "Watch the video back and learn", effects: {"hidden": {"workEthic": 2}} },
    { id: 'bounce_back', label: "Channel the hurt into next week", effects: {"hidden": {"workEthic": 1}} }
  ],    effects: { hidden: { confidence: -2, workEthic: 2 } },
  },

  // --- funny ---
  {
    id: 'own_goal_celebration_mixup',
    category: 'funny',
    weight: 2,
    minAge: 6,
    maxAge: 12,
    cooldownQuarters: 8,
    requiresClub: true,
    text: 'A teammate celebrated an own goal by accident, and the whole team could not stop laughing.',

    choices: [
    { id: 'laugh', label: "Laugh with the team", effects: {"hidden": {"confidence": 1}} },
    { id: 'cringe', label: "Cringe quietly for the rest of the match", effects: {"hidden": {"confidence": -1}} }
  ],    effects: { hidden: { confidence: 1 } },
  },
  {
    id: 'mascot_mishap',
    category: 'funny',
    weight: 1,
    minAge: 6,
    maxAge: 14,
    cooldownQuarters: 10,
    text: "The club mascot tripped over the corner flag mid-match and everyone lost it laughing.",
    effects: { hidden: { confidence: 1 } },
  },
  {
    id: 'prank_on_teammate',
    category: 'funny',
    weight: 2,
    minAge: 7,
    maxAge: 16,
    cooldownQuarters: 6,
    requiresClub: true,
    text: "{name} swapped a teammate's boots with a much smaller pair as a prank.",
    effects: { relationship: { who: 'teammate', dims: { opinion: 1 } } },
  },
  {
    id: 'forgot_boots',
    category: 'funny',
    weight: 2,
    minAge: 6,
    maxAge: 16,
    cooldownQuarters: 6,
    requiresClub: true,
    text: '{name} forgot boots for training and had to borrow an old pair two sizes too big.',

    choices: [
    { id: 'own_up', label: "Own up to the coach right away", effects: {"hidden": {"workEthic": 1}} },
    { id: 'blame_mum', label: "Quietly blame a parent for the morning", effects: {"hidden": {"confidence": -2}} }
  ],    effects: { hidden: { confidence: -1 } },
  },

  // --- rare ---
  {
    id: 'big_academy_scout_visit',
    category: 'rare',
    weight: 1,
    minAge: 8,
    maxAge: 16,
    cooldownQuarters: 99,
    once: true,
    requiresClub: true,
    text: 'A scout from a major academy quietly watched training from the sideline.',

    choices: [
    { id: 'play_normal', label: "Play the way you always do", effects: {"hidden": {"confidence": 2}} },
    { id: 'try_too_hard', label: "Try to do too much in one go", effects: {"hidden": {"fatigue": 3, "confidence": 1}} }
  ],    effects: { hidden: { confidence: 3 } },
  },
  {
    id: 'local_news_feature',
    category: 'rare',
    weight: 1,
    minAge: 8,
    maxAge: 16,
    cooldownQuarters: 99,
    once: true,
    requiresClub: true,
    text: 'A local newspaper ran a short feature on the youth team, with a photo of {name} in it.',

    choices: [
    { id: 'share_news', label: "Share the article with the family", effects: {"hidden": {"confidence": 2}} },
    { id: 'shy_about_it', label: "Tuck the paper in a drawer", effects: {"hidden": {"confidence": 1}} }
  ],    effects: { hidden: { confidence: 2 } },
  },
  {
    id: 'meets_professional_player',
    category: 'rare',
    weight: 1,
    minAge: 7,
    maxAge: 16,
    cooldownQuarters: 99,
    once: true,
    text: '{name} met a professional player at a club open day and got some advice worth remembering.',

    choices: [
    { id: 'ask_questions', label: "Ask lots of questions and listen", effects: {"hidden": {"confidence": 2, "workEthic": 2}} },
    { id: 'shy_photo', label: "Take a shy photo and say little", effects: {"hidden": {"confidence": 1}} }
  ],    effects: { hidden: { confidence: 3, workEthic: 1 } },
  },

  // ===================================================================
  // AUTHORED DENSITY PASS — 105 new events for the youth arc.
  // Distribution: 30 ages 5-7, 30 ages 8-10, 12 ages 11-13, 8 ages 14-16,
  // 25 multi-band cross-cutting.
  // ===================================================================

  // --- school (ages 5-7) ---
  {
    id: 'learns_to_tie_shoelaces',
    category: 'school',
    weight: 2,
    minAge: 5,
    maxAge: 6,
    cooldownQuarters: 6,
    text: '{name} finally learned to tie their own shoelaces one quiet morning.',

    choices: [
    { id: 'patience', label: "Practise with patience", effects: {"hidden": {"workEthic": 1, "confidence": 2}} },
    { id: 'frustration', label: "Get frustrated and ask for help", effects: {"hidden": {"confidence": 1}} }
  ],    effects: { hidden: { confidence: 2 } },
  },
  {
    id: 'playground_buddy_invite',
    category: 'school',
    weight: 2,
    minAge: 5,
    maxAge: 7,
    cooldownQuarters: 3,
    text: 'A classmate asked {name} to play together at break.',

    choices: [
    { id: 'play_together', label: "Run over and play together", effects: {"hidden": {"confidence": 1}} },
    { id: 'shy_yes', label: "Shy nod and tag along", effects: {"hidden": {"confidence": 0}} }
  ],    effects: { hidden: { confidence: 1 } },
  },
  {
    id: 'show_and_tell_star',
    category: 'school',
    weight: 2,
    minAge: 5,
    maxAge: 7,
    cooldownQuarters: 4,
    text: '{name} brought something special to show-and-tell and the class clapped.',

    choices: [
    { id: 'boast', label: "Tell everyone about it for days", effects: {"hidden": {"confidence": 2, "workEthic": -1}} },
    { id: 'modest', label: "Stay modest and move on", effects: {"hidden": {"workEthic": 1}} }
  ],    effects: { hidden: { confidence: 2, workEthic: 1 } },
  },
  {
    id: 'rainy_walk_home',
    category: 'school',
    weight: 1,
    minAge: 5,
    maxAge: 7,
    cooldownQuarters: 5,
    text: 'The walk home from school got soaked in a sudden downpour.',

    choices: [
    { id: 'splash', label: "Splash in every puddle on the way", effects: {"hidden": {"fatigue": 2, "confidence": 1}} },
    { id: 'shelter', label: "Find shelter and wait it out", effects: {"hidden": {"fatigue": 1}} }
  ],    effects: { hidden: { fatigue: 2 } },
  },
  {
    id: 'first_library_card',
    category: 'school',
    weight: 1,
    minAge: 5,
    maxAge: 7,
    cooldownQuarters: 99,
    once: true,
    text: '{name} got a first library card and immediately picked three books.',

    choices: [
    { id: 'explore', label: "Browse every shelf for an hour", effects: {"hidden": {"workEthic": 1}} },
    { id: 'ask_help', label: "Ask the librarian for help picking", effects: {"hidden": {"confidence": 1}} }
  ],    effects: { hidden: { workEthic: 1 } },
  },
  {
    id: 'class_pet_duties',
    category: 'school',
    weight: 1,
    minAge: 5,
    maxAge: 7,
    cooldownQuarters: 4,
    text: '{name} took a turn feeding the class pet and took it very seriously.',

    choices: [
    { id: 'careful', label: "Take great care with every detail", effects: {"hidden": {"workEthic": 2}} },
    { id: 'rush', label: "Get it done quickly", effects: {"hidden": {"workEthic": 0, "fatigue": 1}} }
  ],    effects: { hidden: { workEthic: 2 } },
  },
  {
    id: 'playground_argument',
    category: 'school',
    weight: 2,
    minAge: 5,
    maxAge: 7,
    cooldownQuarters: 4,
    text: 'A playground disagreement blew up over a missing game piece.',
    choices: [
      { id: 'apologise', label: 'Apologise to keep the peace', effects: { hidden: { confidence: -1 } } },
      { id: 'explain', label: 'Explain calmly what happened', effects: { hidden: { confidence: 2 } } },
    ],
  },
  {
    id: 'new_kid_at_school',
    category: 'school',
    weight: 2,
    minAge: 5,
    maxAge: 7,
    cooldownQuarters: 4,
    text: 'A new kid joined the class and did not know anyone yet.',
    choices: [
      { id: 'invite_play', label: 'Invite them to play at break', effects: { hidden: { confidence: 2 } } },
      { id: 'wait', label: 'Wait for them to settle in first', effects: {} },
    ],
  },
  {
    id: 'reading_milestone',
    category: 'school',
    weight: 1,
    minAge: 5,
    maxAge: 7,
    cooldownQuarters: 99,
    once: true,
    text: '{name} read a short picture book aloud to the teacher without help.',

    choices: [
    { id: 'accept_praise', label: "Take the teacher's praise with a grin", effects: {"hidden": {"confidence": 2}} },
    { id: 'shrug', label: "Shrug it off as no big deal", effects: {"hidden": {"workEthic": 1}} }
  ],    effects: { hidden: { confidence: 2, workEthic: 1 } },
  },
  {
    id: 'lunch_trade_offer',
    category: 'school',
    weight: 2,
    minAge: 5,
    maxAge: 7,
    cooldownQuarters: 3,
    text: 'A classmate offered to trade lunch snacks at the table.',
    choices: [
      { id: 'trade', label: 'Trade half the lunch', effects: { hidden: { confidence: 1 } } },
      { id: 'keep', label: 'Politely decline', effects: {} },
    ],
  },
  {
    id: 'counting_challenge',
    category: 'school',
    weight: 1,
    minAge: 5,
    maxAge: 7,
    cooldownQuarters: 5,
    text: 'The teacher set a counting challenge and {name} finished first.',

    choices: [
    { id: 'race', label: "Race to the answer", effects: {"hidden": {"confidence": 2}} },
    { id: 'careful', label: "Take a careful moment before answering", effects: {"hidden": {"workEthic": 1}} }
  ],    effects: { hidden: { confidence: 2 } },
  },
  {
    id: 'class_assembly_singer',
    category: 'school',
    weight: 1,
    minAge: 5,
    maxAge: 7,
    cooldownQuarters: 99,
    once: true,
    text: '{name} stood in front of the school and sang a tiny solo at assembly.',

    choices: [
    { id: 'sing_loud', label: "Sing the solo loud and proud", effects: {"hidden": {"confidence": 3}} },
    { id: 'quiet_nerves', label: "Get through it with quiet nerves", effects: {"hidden": {"confidence": 1}} }
  ],    effects: { hidden: { confidence: 3 } },
  },
  {
    id: 'lost_lunchbox',
    category: 'school',
    weight: 1,
    minAge: 5,
    maxAge: 7,
    cooldownQuarters: 6,
    text: '{name} lost the lunchbox at school and had to borrow a spare.',

    choices: [
    { id: 'retrace', label: "Retrace steps to find it", effects: {"hidden": {"workEthic": 1}} },
    { id: 'borrow', label: "Borrow a spare and move on", effects: {"hidden": {"confidence": -1}} }
  ],    effects: { hidden: { confidence: -1 } },
  },
  {
    id: 'art_class_praise',
    category: 'school',
    weight: 1,
    minAge: 5,
    maxAge: 7,
    cooldownQuarters: 5,
    text: 'The art teacher hung {name}\'s painting on the classroom wall.',

    choices: [
    { id: 'talk_about_it', label: "Talk about the painting with friends", effects: {"hidden": {"confidence": 2}} },
    { id: 'quiet_pride', label: "Smile quietly and keep painting", effects: {"hidden": {"workEthic": 1}} }
  ],    effects: { hidden: { confidence: 2 } },
  },
  {
    id: 'school_trip_dressup',
    category: 'school',
    weight: 1,
    minAge: 5,
    maxAge: 7,
    cooldownQuarters: 6,
    text: 'A school trip involved dressing up, and {name} chose carefully.',

    choices: [
    { id: 'elaborate', label: "Go all in on a costume", effects: {"hidden": {"confidence": 2}} },
    { id: 'practical', label: "Dress sensibly for the weather", effects: {"hidden": {"workEthic": 1}} }
  ],    effects: { hidden: { confidence: 1 } },
  },
  {
    id: 'morning_class_helper',
    category: 'school',
    weight: 1,
    minAge: 5,
    maxAge: 7,
    cooldownQuarters: 4,
    text: '{name} was asked to help set up the classroom before lessons.',

    choices: [
    { id: 'tidy', label: "Help tidy everything neatly", effects: {"hidden": {"workEthic": 2}} },
    { id: 'chat', label: "Chat through the jobs with friends", effects: {"hidden": {"workEthic": 1, "confidence": 1}} }
  ],    effects: { hidden: { workEthic: 2 } },
  },
  {
    id: 'math_homework_win',
    category: 'school',
    weight: 1,
    minAge: 6,
    maxAge: 7,
    cooldownQuarters: 4,
    text: 'A tricky maths homework sheet finally clicked for {name}.',

    choices: [
    { id: 'keep_momentum', label: "Keep practising through the week", effects: {"hidden": {"workEthic": 2}} },
    { id: 'treat', label: "Treat yourself to a break", effects: {"hidden": {"fatigue": -2}} }
  ],    effects: { hidden: { workEthic: 2 } },
  },
  {
    id: 'handwriting_practice',
    category: 'school',
    weight: 1,
    minAge: 5,
    maxAge: 7,
    cooldownQuarters: 5,
    text: 'The teacher asked everyone to practise handwriting at home for a week.',
    choices: [
      { id: 'practice_daily', label: 'Practise a little every day', effects: { hidden: { workEthic: 2 } } },
      { id: 'one_long_session', label: 'Cram it all the night before', effects: { hidden: { workEthic: -1, fatigue: 3 } } },
    ],
  },
  {
    id: 'borrowed_classroom_pet',
    category: 'school',
    weight: 1,
    minAge: 5,
    maxAge: 7,
    cooldownQuarters: 99,
    once: true,
    text: '{name} got to take the class hamster home for a long weekend.',

    choices: [
    { id: 'careful', label: "Watch the hamster like a hawk", effects: {"hidden": {"workEthic": 2, "fatigue": 3}} },
    { id: 'relaxed', label: "Take a relaxed approach and let it roam", effects: {"hidden": {"fatigue": 2}} }
  ],    effects: { hidden: { workEthic: 1, fatigue: 3 } },
  },
  {
    id: 'playground_team_pick',
    category: 'school',
    weight: 2,
    minAge: 5,
    maxAge: 7,
    cooldownQuarters: 4,
    text: 'The class picked teams for a playground game.',
    choices: [
      { id: 'picked_first', label: 'Was picked early and felt proud', effects: { hidden: { confidence: 2 } } },
      { id: 'picked_late', label: 'Was picked near the end', effects: { hidden: { confidence: -1 } } },
    ],
  },
  {
    id: 'school_disco_invite',
    category: 'school',
    weight: 1,
    minAge: 6,
    maxAge: 7,
    cooldownQuarters: 99,
    once: true,
    text: 'The first school disco was announced and the class could not stop talking about it.',
    effects: { hidden: { confidence: 1 } },
  },
  {
    id: 'new_school_supplies',
    category: 'school',
    weight: 1,
    minAge: 5,
    maxAge: 7,
    cooldownQuarters: 99,
    once: true,
    text: 'A shiny new set of school supplies arrived in a backpack the night before term started.',
    effects: { hidden: { confidence: 1, workEthic: 1 } },
  },
  {
    id: 'colouring_competition',
    category: 'school',
    weight: 1,
    minAge: 5,
    maxAge: 7,
    cooldownQuarters: 5,
    text: 'A class colouring competition was announced with a small prize.',
    choices: [
      { id: 'careful', label: 'Take it slow and stay inside the lines', effects: { hidden: { workEthic: 2 } } },
      { id: 'creative', label: 'Add a few flourishes of your own', effects: { hidden: { confidence: 1 } } },
    ],
  },
  {
    id: 'first_friendship_wobble',
    category: 'school',
    weight: 1,
    minAge: 5,
    maxAge: 7,
    cooldownQuarters: 6,
    text: '{name} and a close friend had a small wobble in their friendship.',
    choices: [
      { id: 'talk_to_teacher', label: 'Talk to the teacher about it', effects: { hidden: { confidence: -1 } } },
      { id: 'sort_it_out', label: 'Try to sort it out at break', effects: { hidden: { confidence: 2 } } },
    ],
  },
  {
    id: 'lost_homework_note',
    category: 'school',
    weight: 1,
    minAge: 5,
    maxAge: 7,
    cooldownQuarters: 5,
    text: 'A homework note from the teacher went missing on the way home.',
    choices: [
      { id: 'tell_truth', label: 'Tell the teacher the truth', effects: { hidden: { confidence: 1, workEthic: 1 } } },
      { id: 'hope_for_best', label: 'Hope nobody notices', effects: { hidden: { confidence: -1 } } },
    ],
  },
  {
    id: 'reading_buddy_pairing',
    category: 'school',
    weight: 1,
    minAge: 5,
    maxAge: 7,
    cooldownQuarters: 4,
    text: '{name} was paired with an older buddy for shared reading time.',
    effects: { hidden: { workEthic: 1 } },
  },
  {
    id: 'school_photo_day',
    category: 'school',
    weight: 1,
    minAge: 5,
    maxAge: 7,
    cooldownQuarters: 99,
    once: true,
    text: 'The whole school gathered for class photo day and smiles got a little tired by the end.',

    choices: [
    { id: 'smile_big', label: "Smile the biggest smile", effects: {"hidden": {"confidence": 1}} },
    { id: 'silly_face', label: "Pull a tiny silly face", effects: {"hidden": {"confidence": 1}} }
  ],    effects: { hidden: { confidence: 1 } },
  },
  {
    id: 'spring_class_party',
    category: 'school',
    weight: 1,
    minAge: 5,
    maxAge: 7,
    cooldownQuarters: 99,
    once: true,
    text: 'A small class party marked the end of the spring term with snacks and games.',

    choices: [
    { id: 'organise', label: "Help organise games and snacks", effects: {"hidden": {"workEthic": 2}} },
    { id: 'enjoy', label: "Just enjoy the party", effects: {"hidden": {"fatigue": 1}} }
  ],    effects: { hidden: { confidence: 1, fatigue: 2 } },
  },
  {
    id: 'joined_drama_circle',
    category: 'school',
    weight: 1,
    minAge: 6,
    maxAge: 7,
    cooldownQuarters: 6,
    text: '{name} joined the after-school drama circle for the first time.',

    choices: [
    { id: 'try_a_role', label: "Try out for a small speaking role", effects: {"hidden": {"confidence": 2}} },
    { id: 'backstage', label: "Help out backstage first", effects: {"hidden": {"workEthic": 1}} }
  ],    effects: { hidden: { confidence: 2 } },
  },
  {
    id: 'teacher_off_sick',
    category: 'school',
    weight: 1,
    minAge: 6,
    maxAge: 7,
    cooldownQuarters: 6,
    text: 'The usual teacher was off sick and a substitute took the class.',

    choices: [
    { id: 'focus', label: "Focus hard on the work in silence", effects: {"hidden": {"workEthic": 2}} },
    { id: 'chatty', label: "Have a chatty day and get little done", effects: {"hidden": {"workEthic": -1}} }
  ],    effects: { hidden: { workEthic: 1 } },
  },

  // --- life (ages 5-7) ---
  {
    id: 'first_haircut_salon',
    category: 'life',
    weight: 1,
    minAge: 5,
    maxAge: 7,
    cooldownQuarters: 6,
    text: '{name} sat in a salon chair for a proper haircut and came out looking sharp.',

    choices: [
    { id: 'chatty', label: "Chat with the hairdresser the whole time", effects: {"hidden": {"confidence": 1}} },
    { id: 'quiet', label: "Stay quiet and watch in the mirror", effects: {"hidden": {"confidence": 0}} }
  ],    effects: { hidden: { confidence: 1 } },
  },
  {
    id: 'lost_first_tooth',
    category: 'life',
    weight: 2,
    minAge: 5,
    maxAge: 7,
    cooldownQuarters: 6,
    text: '{name} lost a first tooth and left it under the pillow that night.',

    choices: [
    { id: 'leave_under_pillow', label: "Leave it under the pillow with care", effects: {"hidden": {"confidence": 2}} },
    { id: 'wiggle_all_day', label: "Wiggle the next one all day", effects: {"hidden": {"fatigue": 1}} }
  ],    effects: { hidden: { confidence: 2 } },
  },
  {
    id: 'birthday_party_invite',
    category: 'life',
    weight: 2,
    minAge: 5,
    maxAge: 7,
    cooldownQuarters: 4,
    text: '{name} was invited to a friend\'s birthday party on the weekend.',

    choices: [
    { id: 'rsvp_quick', label: "Reply the same day and pick an outfit", effects: {"hidden": {"confidence": 1}} },
    { id: 'fret', label: "Fret about who else will be there", effects: {"hidden": {"confidence": -1}} }
  ],    effects: { hidden: { confidence: 1 } },
  },
  {
    id: 'hosted_first_sleepover',
    category: 'life',
    weight: 1,
    minAge: 6,
    maxAge: 7,
    cooldownQuarters: 99,
    once: true,
    text: '{name} hosted a first sleepover and the giggles lasted well past midnight.',
    effects: { hidden: { confidence: 1, fatigue: 4 } },
  },
  {
    id: 'helps_in_the_kitchen',
    category: 'life',
    weight: 1,
    minAge: 5,
    maxAge: 7,
    cooldownQuarters: 4,
    text: '{name} helped stir a pot of soup and felt very grown up.',

    choices: [
    { id: 'careful', label: "Stir very carefully the whole time", effects: {"hidden": {"workEthic": 1}} },
    { id: 'taste', label: "Taste-test at every opportunity", effects: {"hidden": {"fatigue": -1}} }
  ],    effects: { hidden: { workEthic: 1 } },
  },
  {
    id: 'wobbly_bunk_bed',
    category: 'life',
    weight: 1,
    minAge: 5,
    maxAge: 7,
    cooldownQuarters: 99,
    once: true,
    text: '{name} got promoted to the top bunk and immediately regretted it during the night.',
    effects: { hidden: { confidence: 1, fatigue: 3 } },
  },
  {
    id: 'made_friends_with_neighbour',
    category: 'life',
    weight: 1,
    minAge: 5,
    maxAge: 7,
    cooldownQuarters: 8,
    text: '{name} made friends with the neighbour\'s child over a shared fence.',

    choices: [
    { id: 'invite_over', label: "Invite the new friend over", effects: {"hidden": {"confidence": 1}} },
    { id: 'wave_only', label: "Wave over the fence for now", effects: {} }
  ],    effects: { hidden: { confidence: 1 } },
  },
  {
    id: 'family_walk_in_rain',
    category: 'life',
    weight: 1,
    minAge: 5,
    maxAge: 7,
    cooldownQuarters: 6,
    text: 'A family weekend walk turned into a wet and squelchy adventure.',

    choices: [
    { id: 'splash', label: "Splash in every puddle on the route", effects: {"hidden": {"fatigue": 2}} },
    { id: 'shelter', label: "Find shelter under a big umbrella", effects: {"hidden": {"fatigue": 1}} }
  ],    effects: { hidden: { fatigue: 2 } },
  },
  {
    id: 'new_bedtime_storybook',
    category: 'life',
    weight: 1,
    minAge: 5,
    maxAge: 7,
    cooldownQuarters: 5,
    text: 'A new bedtime storybook arrived and the same chapter was requested four nights running.',
    effects: { hidden: { workEthic: 1 } },
  },
  {
    id: 'helps_grandparent',
    category: 'life',
    weight: 1,
    minAge: 5,
    maxAge: 7,
    cooldownQuarters: 6,
    text: '{name} spent an afternoon helping a grandparent with small jobs around the house.',

    choices: [
    { id: 'patient', label: "Listen carefully to every job", effects: {"hidden": {"workEthic": 2}} },
    { id: 'efficient', label: "Speed through the jobs", effects: {"hidden": {"workEthic": 1}} }
  ],    effects: { hidden: { workEthic: 2 } },
  },
  {
    id: 'first_eye_test',
    category: 'life',
    weight: 1,
    minAge: 5,
    maxAge: 7,
    cooldownQuarters: 99,
    once: true,
    text: '{name} sat through a first proper eye test at the optician.',
    effects: { hidden: { workEthic: 1 } },
  },
  {
    id: 'learns_to_ride_bike',
    category: 'life',
    weight: 2,
    minAge: 5,
    maxAge: 7,
    cooldownQuarters: 99,
    once: true,
    text: '{name} finally took off the stabilisers and rode a whole street solo.',
    choices: [
      { id: 'practice_alone', label: 'Practise in the driveway on your own', effects: { hidden: { confidence: 3, workEthic: 1 } } },
      { id: 'with_parent', label: 'Have a parent steady the seat', effects: { hidden: { confidence: 1 } } },
    ],
  },
  {
    id: 'movie_night_at_home',
    category: 'life',
    weight: 1,
    minAge: 5,
    maxAge: 7,
    cooldownQuarters: 5,
    text: 'The family picked a film, made popcorn, and watched it curled up on the sofa.',
    effects: { hidden: { fatigue: -2 } },
  },
  {
    id: 'first_chore_chart',
    category: 'life',
    weight: 1,
    minAge: 5,
    maxAge: 7,
    cooldownQuarters: 99,
    once: true,
    text: 'A chore chart appeared on the fridge with shiny gold stars to earn.',
    choices: [
      { id: 'earn_every_star', label: 'Try to earn every single star', effects: { hidden: { workEthic: 3 } } },
      { id: 'do_basics', label: 'Do the basics and call it done', effects: { hidden: { workEthic: 1 } } },
    ],
  },
  {
    id: 'plays_in_puddles',
    category: 'life',
    weight: 1,
    minAge: 5,
    maxAge: 7,
    cooldownQuarters: 6,
    text: '{name} splashed in muddy puddles after a heavy rainstorm.',

    choices: [
    { id: 'boots', label: "Splash in full boots", effects: {"hidden": {"fatigue": 1, "confidence": 1}} },
    { id: 'wellies_off', label: "Kick the wellies off and go barefoot", effects: {"hidden": {"fatigue": 2, "confidence": 1}} }
  ],    effects: { hidden: { fatigue: 2, confidence: 1 } },
  },
  {
    id: 'builds_a_fort',
    category: 'life',
    weight: 1,
    minAge: 5,
    maxAge: 7,
    cooldownQuarters: 8,
    text: '{name} built a blanket fort in the living room and refused to come out for dinner.',

    choices: [
    { id: 'engineering', label: "Engineer the fort fortresses to stand", effects: {"hidden": {"workEthic": 1}} },
    { id: 'cosy', label: "Build a small cosy den instead", effects: {"hidden": {"fatigue": -1}} }
  ],    effects: { hidden: { confidence: 1 } },
  },
  {
    id: 'missing_pet_for_a_day',
    category: 'life',
    weight: 1,
    minAge: 5,
    maxAge: 7,
    cooldownQuarters: 8,
    text: 'The family pet hid under a bed for a whole afternoon before being coaxed out.',

    choices: [
    { id: 'search_team', label: "Help search the whole house", effects: {"hidden": {"workEthic": 1}} },
    { id: 'wait', label: "Wait and let the pet come out alone", effects: {"hidden": {"confidence": -1}} }
  ],    effects: { hidden: { confidence: -1 } },
  },
  {
    id: 'gets_first_watch',
    category: 'life',
    weight: 1,
    minAge: 6,
    maxAge: 7,
    cooldownQuarters: 99,
    once: true,
    text: 'A small digital watch with a stopwatch was the new prized possession for a whole quarter.',
    effects: { hidden: { confidence: 2 } },
  },
  {
    id: 'helps_grocery_shopping',
    category: 'life',
    weight: 1,
    minAge: 5,
    maxAge: 7,
    cooldownQuarters: 5,
    text: '{name} was trusted to pick fruit at the shop without help.',

    choices: [
    { id: 'list', label: "Stick to the shopping list", effects: {"hidden": {"workEthic": 1}} },
    { id: 'extras', label: "Pick a treat as well", effects: {"hidden": {"confidence": 1}} }
  ],    effects: { hidden: { workEthic: 1, confidence: 1 } },
  },
  {
    id: 'rainy_day_drawing',
    category: 'life',
    weight: 1,
    minAge: 5,
    maxAge: 7,
    cooldownQuarters: 4,
    text: 'A long rainy afternoon was filled with drawings taped to the kitchen wall.',

    choices: [
    { id: 'series', label: "Draw a whole comic series", effects: {"hidden": {"workEthic": 2}} },
    { id: 'one_big', label: "Draw one big picture in detail", effects: {"hidden": {"workEthic": 1}} }
  ],    effects: { hidden: { confidence: 1 } },
  },
  {
    id: 'first_time_at_the_dentist',
    category: 'life',
    weight: 1,
    minAge: 5,
    maxAge: 7,
    cooldownQuarters: 99,
    once: true,
    text: 'The dentist was friendly, the chair moved up and down, and a small sticker came home as proof.',

    choices: [
    { id: 'chatty', label: "Chat through the whole appointment", effects: {"hidden": {"confidence": 1}} },
    { id: 'brave_silence', label: "Stay brave and quiet the whole time", effects: {"hidden": {"confidence": 1}} }
  ],    effects: { hidden: { confidence: 1 } },
  },
  {
    id: 'walks_to_friends_house_alone',
    category: 'life',
    weight: 1,
    minAge: 6,
    maxAge: 7,
    cooldownQuarters: 99,
    once: true,
    text: '{name} was allowed to walk to a friend\'s house alone for the first time.',

    choices: [
    { id: 'shortcuts', label: "Take the long route through shortcuts", effects: {"hidden": {"confidence": 3}} },
    { id: 'main_road', label: "Walk the main road the whole way", effects: {"hidden": {"confidence": 1}} }
  ],    effects: { hidden: { confidence: 3 } },
  },
  {
    id: 'helps_make_breakfast',
    category: 'life',
    weight: 1,
    minAge: 5,
    maxAge: 7,
    cooldownQuarters: 4,
    text: '{name} helped crack eggs and spread butter for the family breakfast.',

    choices: [
    { id: 'full_breakfast', label: "Make a full breakfast for everyone", effects: {"hidden": {"workEthic": 2}} },
    { id: 'just_eggs', label: "Just crack the eggs", effects: {"hidden": {"workEthic": 1}} }
  ],    effects: { hidden: { workEthic: 1 } },
  },
  {
    id: 'family_picnic_in_park',
    category: 'life',
    weight: 1,
    minAge: 5,
    maxAge: 7,
    cooldownQuarters: 6,
    text: 'A family picnic in the park ran long because the swings were too tempting.',

    choices: [
    { id: 'play', label: "Stay on the swings for ages", effects: {"hidden": {"fatigue": -1, "confidence": 1}} },
    { id: 'eat', label: "Go back to the picnic for thirds", effects: {"hidden": {"fatigue": -1}} }
  ],    effects: { hidden: { fatigue: -1, confidence: 1 } },
  },
  {
    id: 'birthday_party_planning',
    category: 'life',
    weight: 1,
    minAge: 5,
    maxAge: 7,
    cooldownQuarters: 99,
    once: true,
    text: '{name} helped pick the theme for an upcoming birthday party with great enthusiasm.',
    effects: { hidden: { confidence: 1 } },
  },
  {
    id: 'garden_tending_first_time',
    category: 'life',
    weight: 1,
    minAge: 5,
    maxAge: 7,
    cooldownQuarters: 5,
    text: 'A small patch of garden was handed over for {name} to water and weed.',

    choices: [
    { id: 'daily', label: "Water every single day", effects: {"hidden": {"workEthic": 2}} },
    { id: 'when_remembered', label: "Water when remembered", effects: {"hidden": {"workEthic": 1}} }
  ],    effects: { hidden: { workEthic: 1 } },
  },
  {
    id: 'first_try_at_rollerskating',
    category: 'life',
    weight: 1,
    minAge: 6,
    maxAge: 7,
    cooldownQuarters: 99,
    once: true,
    text: '{name} tried roller-skates for the first time and spent the afternoon on hands and knees.',
    effects: { hidden: { confidence: 1, fatigue: 3 } },
  },
  {
    id: 'helps_with_laundry_sort',
    category: 'life',
    weight: 1,
    minAge: 5,
    maxAge: 7,
    cooldownQuarters: 5,
    text: '{name} learned to sort lights and darks into two separate piles.',

    choices: [
    { id: 'methodical', label: "Sort everything methodically", effects: {"hidden": {"workEthic": 2}} },
    { id: 'helps_anyway', label: "Help even if the piles get muddled", effects: {"hidden": {"workEthic": 1}} }
  ],    effects: { hidden: { workEthic: 1 } },
  },
  {
    id: 'family_visit_to_aquarium',
    category: 'life',
    weight: 1,
    minAge: 5,
    maxAge: 7,
    cooldownQuarters: 99,
    once: true,
    text: 'A family trip to the aquarium kept the whole family pointing at the glass for hours.',

    choices: [
    { id: 'guide', label: "Lead the family to every exhibit", effects: {"hidden": {"confidence": 2}} },
    { id: 'quiet', label: "Take it all in quietly", effects: {"hidden": {"fatigue": 2}} }
  ],    effects: { hidden: { fatigue: 3 } },
  },
  {
    id: 'rain_coat_replacement',
    category: 'life',
    weight: 1,
    minAge: 5,
    maxAge: 7,
    cooldownQuarters: 8,
    text: 'The trusty old raincoat finally sprang a leak and a new one was chosen at the shop.',

    choices: [
    { id: 'bright_colour', label: "Pick a bright new colour", effects: {"hidden": {"confidence": 1}} },
    { id: 'same_colour', label: "Pick the same colour as before", effects: {"hidden": {"workEthic": 1}} }
  ],    effects: { hidden: { confidence: 1 } },
  },
  {
    id: 'learns_simple_card_game',
    category: 'life',
    weight: 1,
    minAge: 5,
    maxAge: 7,
    cooldownQuarters: 5,
    text: '{name} learned a simple card game with the family and beat a parent once.',

    choices: [
    { id: 'serious', label: "Play very seriously and analyse each hand", effects: {"hidden": {"workEthic": 1}} },
    { id: 'laugh', label: "Laugh through every mistake", effects: {"hidden": {"confidence": 1}} }
  ],    effects: { hidden: { confidence: 2 } },
  },

  // --- football (ages 5-7) ---
  {
    id: 'park_kickabout_invite',
    category: 'football',
    weight: 2,
    minAge: 5,
    maxAge: 7,
    cooldownQuarters: 4,
    text: 'A neighbour invited {name} for an impromptu kickabout in the local park.',

    choices: [
    { id: 'join_in', label: "Join in straight away", effects: {"stats": {"passing": 1}, "hidden": {"confidence": 1}} },
    { id: 'watch_first', label: "Watch the bigger kids for a minute first", effects: {} }
  ],    effects: { stats: { passing: 1 }, hidden: { confidence: 1 } },
  },
  {
    id: 'first_park_goal_celebration',
    category: 'football',
    weight: 1,
    minAge: 5,
    maxAge: 7,
    cooldownQuarters: 99,
    once: true,
    text: '{name} scored a first proper goal at the park and ran around with arms out wide.',

    choices: [
    { id: 'arms_out', label: "Run with arms out wide", effects: {"hidden": {"confidence": 3}} },
    { id: 'team_hug', label: "High-five every teammate you can find", effects: {"hidden": {"confidence": 2}} }
  ],    effects: { hidden: { confidence: 3 } },
  },
  {
    id: 'coach_visit_to_school',
    category: 'football',
    weight: 1,
    minAge: 6,
    maxAge: 7,
    cooldownQuarters: 6,
    text: 'A youth coach ran a short session at school to see who might like to join.',
    choices: [
      { id: 'sign_up', label: 'Sign up for the taster', effects: { hidden: { confidence: 2 } } },
      { id: 'watch_only', label: 'Watch from the side', effects: {} },
    ],
  },
  {
    id: 'learns_to_dribble_cones',
    category: 'football',
    weight: 2,
    minAge: 5,
    maxAge: 7,
    cooldownQuarters: 4,
    text: '{name} spent a long afternoon weaving through a line of cones in the back garden.',

    choices: [
    { id: 'fast', label: "Try to go as fast as possible", effects: {"stats": {"pace": 1}, "hidden": {"fatigue": 2}} },
    { id: 'tricks', label: "Add little tricks between cones", effects: {"stats": {"dribbling": 1}} }
  ],    effects: { stats: { dribbling: 1 }, hidden: { fatigue: 2 } },
  },
  {
    id: 'gets_first_football_boots',
    category: 'football',
    weight: 1,
    minAge: 5,
    maxAge: 7,
    cooldownQuarters: 99,
    once: true,
    text: '{name} was bought a first proper pair of football boots and wore them around the house.',

    choices: [
    { id: 'wear_in', label: "Wear them in around the house first", effects: {"hidden": {"workEthic": 1}} },
    { id: 'save_for_match', label: "Save them for the very first match", effects: {"hidden": {"confidence": 1}} }
  ],    effects: { hidden: { confidence: 2 } },
  },
  {
    id: 'big_sibling_passes_tips',
    category: 'football',
    weight: 1,
    minAge: 5,
    maxAge: 7,
    cooldownQuarters: 6,
    text: 'A bigger sibling showed {name} how to pass with the inside of the foot.',

    choices: [
    { id: 'listen_carefully', label: "Listen carefully and try every tip", effects: {"stats": {"passing": 1}} },
    { id: 'try_own_way', label: "Try a few tips your own way", effects: {"stats": {"dribbling": 1}} }
  ],    effects: { stats: { passing: 1 } },
  },
  {
    id: 'watches_match_on_telly',
    category: 'football',
    weight: 1,
    minAge: 5,
    maxAge: 7,
    cooldownQuarters: 5,
    text: '{name} watched a full match on the telly with a parent and asked questions all the way through.',

    choices: [
    { id: 'ask_questions', label: "Ask questions about every position", effects: {"hidden": {"workEthic": 1}} },
    { id: 'just_watch', label: "Just watch quietly and enjoy", effects: {"hidden": {"confidence": 1}} }
  ],    effects: { hidden: { confidence: 1 } },
  },
  {
    id: 'first_training_session',
    category: 'football',
    weight: 1,
    minAge: 6,
    maxAge: 7,
    cooldownQuarters: 99,
    once: true,
    requiresClub: true,
    text: '{name} walked into a first proper club training session and tried not to look nervous.',
    effects: { hidden: { confidence: 2, fatigue: 3 } },
  },
  {
    id: 'parent_runs_laps_with',
    category: 'football',
    weight: 1,
    minAge: 5,
    maxAge: 7,
    cooldownQuarters: 5,
    text: 'A parent jogged laps of the park with {name} at the weekend.',

    choices: [
    { id: 'race', label: "Try to beat the parent every lap", effects: {"stats": {"pace": 1}, "hidden": {"fatigue": 3}} },
    { id: 'steady', label: "Run at a steady pace together", effects: {"hidden": {"fatigue": 2}} }
  ],    effects: { stats: { pace: 1 }, hidden: { fatigue: 3 } },
  },
  {
    id: 'shows_off_tricks_to_friend',
    category: 'football',
    weight: 1,
    minAge: 5,
    maxAge: 7,
    cooldownQuarters: 5,
    text: '{name} showed a school friend every trick they knew in the playground.',

    choices: [
    { id: 'show_off', label: "Show off every trick in the book", effects: {"hidden": {"confidence": 2}} },
    { id: 'teach', label: "Try to teach a trick to the friend", effects: {"hidden": {"confidence": 1, "workEthic": 1}} }
  ],    effects: { hidden: { confidence: 2 } },
  },
  {
    id: 'tiny_goal_in_the_back_garden',
    category: 'football',
    weight: 1,
    minAge: 5,
    maxAge: 7,
    cooldownQuarters: 5,
    text: 'A small pop-up goal turned the back garden into a stadium for an afternoon.',

    choices: [
    { id: 'target_practice', label: "Practise hitting the corners", effects: {"stats": {"shooting": 1}} },
    { id: 'tricks', label: "Try a few tricks before shooting", effects: {"stats": {"dribbling": 1}} }
  ],    effects: { stats: { shooting: 1 } },
  },
  {
    id: 'tired_after_first_match',
    category: 'football',
    weight: 1,
    minAge: 6,
    maxAge: 7,
    cooldownQuarters: 6,
    requiresClub: true,
    text: 'A first proper mini-match left {name} flat out on the grass with legs like jelly.',

    choices: [
    { id: 'rest_properly', label: "Rest properly and hydrate", effects: {"hidden": {"fatigue": -2}} },
    { id: 'push_on', label: "Push through with a snack and adrenaline", effects: {"hidden": {"fatigue": 2}} }
  ],    effects: { hidden: { fatigue: 4 } },
  },
  {
    id: 'coach_offers_praise_after_drills',
    category: 'football',
    weight: 1,
    minAge: 6,
    maxAge: 7,
    cooldownQuarters: 5,
    requiresClub: true,
    text: 'After a hard set of drills the coach gave {name} a high-five in front of the group.',

    choices: [
    { id: 'thank', label: "Say thank you and mean it", effects: {"hidden": {"confidence": 2}} },
    { id: 'ask_more', label: "Ask for more drills next time", effects: {"hidden": {"workEthic": 2}} }
  ],    effects: { hidden: { confidence: 2 } },
  },
  {
    id: 'first_clean_tackle',
    category: 'football',
    weight: 1,
    minAge: 6,
    maxAge: 7,
    cooldownQuarters: 6,
    requiresClub: true,
    text: '{name} won the ball cleanly for the first time without bringing the opponent down.',

    choices: [
    { id: 'applaud_self', label: "Quietly applaud yourself", effects: {"stats": {"defending": 1}, "hidden": {"confidence": 2}} },
    { id: 'on_to_next', label: "Get straight onto the next action", effects: {"hidden": {"workEthic": 1}} }
  ],    effects: { stats: { defending: 1 }, hidden: { confidence: 2 } },
  },
  {
    id: 'rainy_training_smells_like_chlorine',
    category: 'football',
    weight: 1,
    minAge: 6,
    maxAge: 7,
    cooldownQuarters: 6,
    requiresClub: true,
    text: 'Training was moved indoors for the rain and the hall smelled sharply of floor polish.',

    choices: [
    { id: 'work_rate', label: "Keep the work rate high indoors", effects: {"stats": {"physical": 1}, "hidden": {"fatigue": 3}} },
    { id: 'steady', label: "Stay steady through the indoor session", effects: {"hidden": {"fatigue": 2}} }
  ],    effects: { stats: { physical: 1 }, hidden: { fatigue: 3 } },
  },

  // --- funny (ages 5-7) ---
  {
    id: 'wore_boots_to_school',
    category: 'funny',
    weight: 1,
    minAge: 5,
    maxAge: 7,
    cooldownQuarters: 8,
    text: '{name} wore football boots to school by mistake and refused to take them off all day.',

    choices: [
    { id: 'own_it', label: "Own the boots all day", effects: {"hidden": {"confidence": 1}} },
    { id: 'hide_it', label: "Try to hide the boots under the desk", effects: {"hidden": {"confidence": -1}} }
  ],    effects: { hidden: { confidence: 1 } },
  },
  {
    id: 'accidental_haircut',
    category: 'funny',
    weight: 1,
    minAge: 5,
    maxAge: 7,
    cooldownQuarters: 99,
    once: true,
    text: '{name} took scissors to a fringe without asking and the photos live forever.',
    effects: { hidden: { confidence: -1 } },
  },
  {
    id: 'sleepover_snack_argument',
    category: 'funny',
    weight: 1,
    minAge: 6,
    maxAge: 7,
    cooldownQuarters: 6,
    text: 'A sleepover almost ended over a hidden stash of biscuits.',

    choices: [
    { id: 'work_it_out', label: "Work it out over breakfast", effects: {"hidden": {"confidence": 1}} },
    { id: 'silent_treat', label: "Treat the friend to a snack to fix it", effects: {"hidden": {"workEthic": 1}} }
  ],    choices: [
      { id: 'share', label: 'Share the stash with the friend', effects: { hidden: { confidence: 1 } } },
      { id: 'refuse', label: 'Refuse to share', effects: { hidden: { confidence: -1 } } },
    ],
  },
  {
    id: 'toilet_humour_at_dinner',
    category: 'funny',
    weight: 1,
    minAge: 5,
    maxAge: 7,
    cooldownQuarters: 5,
    text: 'A classic toilet joke at the dinner table got the expected groans from the grown-ups.',

    choices: [
    { id: 'deliver', label: "Deliver the punchline with a straight face", effects: {"hidden": {"confidence": 1}} },
    { id: 'apologise', label: "Apologise for the joke at the table", effects: {"hidden": {"workEthic": 1}} }
  ],    effects: { hidden: { confidence: 1 } },
  },
  {
    id: 'wobbles_into_a_lamp_post',
    category: 'funny',
    weight: 1,
    minAge: 5,
    maxAge: 7,
    cooldownQuarters: 6,
    text: '{name} walked into a lamp-post while telling a story and the punchline was lost.',

    choices: [
    { id: 'laugh_off', label: "Laugh it off with the friends", effects: {"hidden": {"confidence": 1}} },
    { id: 'blush', label: "Blush and walk away quickly", effects: {"hidden": {"confidence": -1}} }
  ],    effects: { hidden: { confidence: -1 } },
  },
  {
    id: 'teddy_loses_a_button_eye',
    category: 'funny',
    weight: 1,
    minAge: 5,
    maxAge: 6,
    cooldownQuarters: 99,
    once: true,
    text: 'A favourite teddy lost a button eye and was rushed to the kitchen table for surgery.',
    effects: { hidden: { confidence: -1 } },
  },
  {
    id: 'mismatched_socks_day',
    category: 'funny',
    weight: 1,
    minAge: 5,
    maxAge: 7,
    cooldownQuarters: 5,
    text: '{name} wore two different socks all day without noticing until after school.',

    choices: [
    { id: 'own_the_mismatch', label: "Own the mismatched socks with style", effects: {"hidden": {"confidence": 1}} },
    { id: 'hide_shoes', label: "Keep shoes on all day to hide it", effects: {"hidden": {"confidence": -1}} }
  ],    effects: { hidden: { confidence: 1 } },
  },
  {
    id: 'school_play_forgetful_lines',
    category: 'funny',
    weight: 1,
    minAge: 6,
    maxAge: 7,
    cooldownQuarters: 99,
    once: true,
    text: 'In a class play {name} forgot the lines and improvised something even better.',

    choices: [
    { id: 'improvise', label: "Improvise something funny", effects: {"hidden": {"confidence": 2}} },
    { id: 'freeze', label: "Freeze on stage until rescued", effects: {"hidden": {"confidence": -1}} }
  ],    effects: { hidden: { confidence: 2 } },
  },
  {
    id: 'splash_pad_slips',
    category: 'funny',
    weight: 1,
    minAge: 5,
    maxAge: 7,
    cooldownQuarters: 6,
    text: 'A splash pad turned the whole group into slippery noodles.',

    choices: [
    { id: 'get_up_laughing', label: "Get up laughing", effects: {"hidden": {"confidence": 1}} },
    { id: 'sit_it_out', label: "Sit out the rest of the session", effects: {"hidden": {"confidence": -1}} }
  ],    effects: { hidden: { confidence: 1 } },
  },
  {
    id: 'sleep_talks_at_a_friend',
    category: 'funny',
    weight: 1,
    minAge: 5,
    maxAge: 7,
    cooldownQuarters: 8,
    text: '{name} talked in their sleep at a sleepover and told everyone about it the next morning.',

    choices: [
    { id: 'own_it', label: "Own the story at breakfast", effects: {"hidden": {"confidence": 1}} },
    { id: 'deny', label: "Deny everything even with the evidence", effects: {"hidden": {"confidence": -1}} }
  ],    effects: { hidden: { confidence: 1 } },
  },

  // --- rare (ages 5-7) ---
  {
    id: 'televised_local_match',
    category: 'rare',
    weight: 1,
    minAge: 6,
    maxAge: 7,
    cooldownQuarters: 99,
    once: true,
    requiresClub: true,
    text: 'A local mini-match was filmed for a community TV segment and {name} made the edit.',

    choices: [
    { id: 'wave', label: "Wave at the camera when it pans by", effects: {"hidden": {"confidence": 3}} },
    { id: 'play_normal', label: "Just keep playing like always", effects: {"hidden": {"confidence": 2}} }
  ],    effects: { hidden: { confidence: 3 } },
  },
  {
    id: 'birthday_card_from_a_pro',
    category: 'rare',
    weight: 1,
    minAge: 5,
    maxAge: 7,
    cooldownQuarters: 99,
    once: true,
    text: 'A signed birthday card arrived from a professional player a parent knew long ago.',

    choices: [
    { id: 'pin_on_wall', label: "Pin it on the wall at home", effects: {"hidden": {"confidence": 2}} },
    { id: 'read_quietly', label: "Read it quietly and smile", effects: {"hidden": {"confidence": 1}} }
  ],    effects: { hidden: { confidence: 2 } },
  },

  // ===================================================================
  // AGES 8-10 (30 events)
  // ===================================================================

  // --- school ---
  {
    id: 'class_council_vote',
    category: 'school',
    weight: 2,
    minAge: 8,
    maxAge: 10,
    cooldownQuarters: 5,
    text: 'The class held a vote for class council representatives.',
    choices: [
      { id: 'stand', label: 'Stand for election', effects: { hidden: { confidence: 2, workEthic: 1 } } },
      { id: 'support', label: 'Support a friend\'s campaign', effects: { hidden: { confidence: 1 } } },
    ],
  },
  {
    id: 'science_fair_project',
    category: 'school',
    weight: 2,
    minAge: 8,
    maxAge: 10,
    cooldownQuarters: 4,
    text: '{name} chose a topic for the science fair and the project was weeks of work.',
    choices: [
      { id: 'safe_topic', label: 'Pick a safe topic and do it well', effects: { hidden: { workEthic: 2 } } },
      { id: 'risky_topic', label: 'Pick a risky topic and learn fast', effects: { hidden: { workEthic: 1, confidence: 2 } } },
    ],
  },
  {
    id: 'morning_run_to_school',
    category: 'school',
    weight: 1,
    minAge: 8,
    maxAge: 10,
    cooldownQuarters: 4,
    text: 'A parent started jogging {name} to school on a few cool mornings.',

    choices: [
    { id: 'race_parent', label: "Race the parent to the gate", effects: {"stats": {"pace": 1}, "hidden": {"fatigue": 1}} },
    { id: 'steady', label: "Run at a steady pace together", effects: {"hidden": {"fatigue": 0}} }
  ],    effects: { stats: { pace: 1 } },
  },
  {
    id: 'school_newspaper_pitch',
    category: 'school',
    weight: 1,
    minAge: 8,
    maxAge: 10,
    cooldownQuarters: 5,
    text: '{name} pitched a story for the school newspaper and waited nervously for the verdict.',

    choices: [
    { id: 'bold_pitch', label: "Pitch a bold story that could be rejected", effects: {"hidden": {"confidence": 2, "workEthic": 1}} },
    { id: 'safe_pitch', label: "Pitch a safe story that will probably run", effects: {"hidden": {"workEthic": 1}} }
  ],    effects: { hidden: { confidence: 1, workEthic: 1 } },
  },
  {
    id: 'music_recital_first',
    category: 'school',
    weight: 1,
    minAge: 8,
    maxAge: 10,
    cooldownQuarters: 99,
    once: true,
    text: 'A first school music recital ended with shaky bows and a small round of applause.',

    choices: [
    { id: 'preparation', label: "Practise every day for a week beforehand", effects: {"hidden": {"workEthic": 2, "confidence": 1}} },
    { id: 'nerves', label: "Practise a little but mostly deal with nerves", effects: {"hidden": {"confidence": 1}} }
  ],    effects: { hidden: { confidence: 2 } },
  },
  {
    id: 'book_read_for_school',
    category: 'school',
    weight: 1,
    minAge: 8,
    maxAge: 10,
    cooldownQuarters: 5,
    text: 'A chapter book on the reading list really gripped {name} and was finished in two nights.',

    choices: [
    { id: 'book_report', label: "Write a careful book report", effects: {"hidden": {"workEthic": 2}} },
    { id: 'just_read', label: "Just enjoy the book and forget the report", effects: {"hidden": {"fatigue": -1}} }
  ],    effects: { hidden: { workEthic: 1 } },
  },
  {
    id: 'school_uniform_grows_short',
    category: 'school',
    weight: 1,
    minAge: 8,
    maxAge: 10,
    cooldownQuarters: 99,
    once: true,
    text: 'The school trousers got suspiciously short and a shopping trip was inevitable.',

    choices: [
    { id: 'roll_up', label: "Roll the trouser cuffs up", effects: {"hidden": {"confidence": -1}} },
    { id: 'new_pair', label: "Ask for a brand new pair straight away", effects: {"hidden": {"workEthic": 1}} }
  ],    effects: { hidden: { confidence: -1 } },
  },
  {
    id: 'tablet_class_trial',
    category: 'school',
    weight: 1,
    minAge: 8,
    maxAge: 10,
    cooldownQuarters: 8,
    text: 'The class tried out tablets for the first time and {name} finished first on every quiz.',

    choices: [
    { id: 'race', label: "Race through the quiz questions", effects: {"hidden": {"confidence": 2}} },
    { id: 'careful', label: "Take time on each answer", effects: {"hidden": {"workEthic": 1}} }
  ],    effects: { hidden: { confidence: 2, workEthic: 1 } },
  },

  // --- life (ages 8-10) ---
  {
    id: 'first_camping_tent',
    category: 'life',
    weight: 1,
    minAge: 8,
    maxAge: 10,
    cooldownQuarters: 99,
    once: true,
    text: '{name} slept in a small tent in the back garden and the sounds were enormous.',
    effects: { hidden: { confidence: 2, fatigue: 3 } },
  },
  {
    id: 'gets_first_mobile_phone',
    category: 'life',
    weight: 1,
    minAge: 8,
    maxAge: 10,
    cooldownQuarters: 99,
    once: true,
    text: 'A simple phone with three games on it was the most exciting thing {name} owned for a quarter.',
    effects: { hidden: { confidence: 2 } },
  },
  {
    id: 'family_holiday_at_seaside',
    category: 'life',
    weight: 1,
    minAge: 8,
    maxAge: 10,
    cooldownQuarters: 99,
    once: true,
    text: 'A family holiday at the seaside involved sandy sandwiches and endless rock-pooling.',
    effects: { hidden: { fatigue: -2, confidence: 1 } },
  },
  {
    id: 'helps_carry_shopping',
    category: 'life',
    weight: 1,
    minAge: 8,
    maxAge: 10,
    cooldownQuarters: 5,
    text: '{name} carried more bags than usual from the supermarket and felt useful.',

    choices: [
    { id: 'multiple_trips', label: "Make multiple trips to be safe", effects: {"hidden": {"workEthic": 2}} },
    { id: 'one_trip', label: "Try to carry everything in one trip", effects: {"hidden": {"fatigue": 2, "workEthic": 1}} }
  ],    effects: { hidden: { workEthic: 2 } },
  },
  {
    id: 'first_time_babysitting',
    category: 'life',
    weight: 1,
    minAge: 8,
    maxAge: 10,
    cooldownQuarters: 99,
    once: true,
    text: 'An older sibling left {name} in charge of a younger one for an hour and the report came back fine.',
    effects: { hidden: { confidence: 2, workEthic: 1 } },
  },
  {
    id: 'mends_a_broken_toy',
    category: 'life',
    weight: 1,
    minAge: 8,
    maxAge: 10,
    cooldownQuarters: 5,
    text: 'A favourite toy broke and {name} managed a careful mend with strong tape.',

    choices: [
    { id: 'careful', label: "Mend it carefully and slowly", effects: {"hidden": {"workEthic": 2}} },
    { id: 'quick_fix', label: "Whip out a quick fix with strong tape", effects: {"hidden": {"workEthic": 1}} }
  ],    effects: { hidden: { workEthic: 1 } },
  },
  {
    id: 'birthday_pool_party',
    category: 'life',
    weight: 1,
    minAge: 8,
    maxAge: 10,
    cooldownQuarters: 8,
    text: 'A friend\'s birthday pool party meant a long afternoon of dives and games.',

    choices: [
    { id: 'dive_in', label: "Dive in at the deep end straight away", effects: {"hidden": {"fatigue": 3, "confidence": 1}} },
    { id: 'shallow_first', label: "Stay in the shallow end for a while", effects: {"hidden": {"fatigue": 2}} }
  ],    effects: { hidden: { fatigue: 3, confidence: 1 } },
  },
  {
    id: 'learns_to_use_public_transport',
    category: 'life',
    weight: 1,
    minAge: 9,
    maxAge: 10,
    cooldownQuarters: 99,
    once: true,
    text: '{name} learned to read a bus timetable and caught a service alone for the first time.',
    effects: { hidden: { confidence: 3, workEthic: 1 } },
  },

  // --- football (ages 8-10) ---
  {
    id: 'first_mini_tournament',
    category: 'football',
    weight: 2,
    minAge: 8,
    maxAge: 10,
    cooldownQuarters: 4,
    requiresClub: true,
    text: '{name} played in a first mini tournament at a neighbouring club.',

    choices: [
    { id: 'go_for_it', label: "Go for it from the first whistle", effects: {"stats": {"pace": 1}, "hidden": {"fatigue": 4}} },
    { id: 'feel_it_out', label: "Feel out the tournament slowly", effects: {"stats": {"passing": 1}, "hidden": {"fatigue": 3}} }
  ],    effects: { stats: { pace: 1 }, hidden: { fatigue: 4 } },
  },
  {
    id: 'position_rotation_trial',
    category: 'football',
    weight: 2,
    minAge: 8,
    maxAge: 10,
    cooldownQuarters: 4,
    requiresClub: true,
    text: 'The coach tried {name} in a different position for a half and watched closely.',
    choices: [
      { id: 'embrace', label: 'Embrace the new position and work hard', effects: { stats: { passing: 1 }, hidden: { confidence: 1 } } },
      { id: 'resist', label: 'Ask to go back to the usual spot', effects: { hidden: { confidence: -1 } } },
    ],
  },
  {
    id: 'first_set_piece_goal',
    category: 'football',
    weight: 1,
    minAge: 8,
    maxAge: 10,
    cooldownQuarters: 99,
    once: true,
    requiresClub: true,
    text: '{name} scored a first set piece goal after weeks of practice.',

    choices: [
    { id: 'practised_spot', label: "Hit the practised corner", effects: {"stats": {"shooting": 2}, "hidden": {"confidence": 3}} },
    { id: 'free_kick', label: "Try the free kick you always wanted", effects: {"stats": {"shooting": 1}, "hidden": {"confidence": 2}} }
  ],    effects: { stats: { shooting: 2 }, hidden: { confidence: 3 } },
  },
  {
    id: 'coach_calls_for_extra_drills',
    category: 'football',
    weight: 1,
    minAge: 8,
    maxAge: 10,
    cooldownQuarters: 5,
    requiresClub: true,
    text: 'The coach asked {name} to stay back for extra shooting drills after training.',

    choices: [
    { id: 'shooting_drills', label: "Stay for shooting drills", effects: {"stats": {"shooting": 1}, "hidden": {"fatigue": 3}} },
    { id: 'free_kicks', label: "Stay for free kick practice", effects: {"stats": {"shooting": 1}, "hidden": {"fatigue": 2}} }
  ],    effects: { stats: { shooting: 1 }, hidden: { fatigue: 3 } },
  },
  {
    id: 'first_clean_sheet_in_match',
    category: 'football',
    weight: 1,
    minAge: 8,
    maxAge: 10,
    cooldownQuarters: 8,
    requiresClub: true,
    text: 'In goal {name} kept a first clean sheet and the team carried them off the pitch.',

    choices: [
    { id: 'celebrate_team', label: "Celebrate with the whole team", effects: {"hidden": {"confidence": 3}} },
    { id: 'quiet_pride', label: "Take a quiet moment of pride", effects: {"hidden": {"workEthic": 1}} }
  ],    effects: { hidden: { confidence: 3 } },
  },
  {
    id: 'called_up_to_older_squad',
    category: 'football',
    weight: 1,
    minAge: 9,
    maxAge: 10,
    cooldownQuarters: 99,
    once: true,
    requiresClub: true,
    text: 'A coach pulled {name} up to train with the older squad for one session.',

    choices: [
    { id: 'rise_to_it', label: "Rise to the moment and work hard", effects: {"hidden": {"confidence": 2, "workEthic": 1, "fatigue": 3}} },
    { id: 'just_keep_up', label: "Try to just keep up", effects: {"hidden": {"fatigue": 3}} }
  ],    effects: { hidden: { confidence: 2, workEthic: 1, fatigue: 3 } },
  },
  {
    id: 'trains_in_rain_at_night',
    category: 'football',
    weight: 1,
    minAge: 8,
    maxAge: 10,
    cooldownQuarters: 6,
    requiresClub: true,
    text: 'A floodlit session in the rain left everyone soaked through but grinning.',

    choices: [
    { id: 'lead_the_charge', label: "Lead the squad through the session", effects: {"stats": {"physical": 1}, "hidden": {"fatigue": 4}} },
    { id: 'steady_effort', label: "Put in a steady effort", effects: {"hidden": {"fatigue": 3}} }
  ],    effects: { stats: { physical: 1 }, hidden: { fatigue: 4 } },
  },
  {
    id: 'first_match_assist',
    category: 'football',
    weight: 1,
    minAge: 8,
    maxAge: 10,
    cooldownQuarters: 8,
    requiresClub: true,
    text: '{name} set up a goal with a through ball and got a high-five from the striker.',

    choices: [
    { id: 'through_ball', label: "Play the through ball again", effects: {"stats": {"passing": 1}, "hidden": {"confidence": 2}} },
    { id: 'cross', label: "Switch to crossing next time", effects: {"stats": {"passing": 1}} }
  ],    effects: { stats: { passing: 1 }, hidden: { confidence: 2 } },
  },
  {
    id: 'practice_after_school_with_friend',
    category: 'football',
    weight: 2,
    minAge: 8,
    maxAge: 10,
    cooldownQuarters: 5,
    requiresClub: true,
    text: '{name} and a friend stayed after school to run through drills together.',
    choices: [
      { id: 'shooting_drills', label: 'Practise shooting for an hour', effects: { stats: { shooting: 1 }, hidden: { fatigue: 2 } } },
      { id: 'passing_drills', label: 'Practise passing together', effects: { stats: { passing: 1 }, hidden: { fatigue: 2 } } },
    ],
  },

  // --- funny (ages 8-10) ---
  {
    id: 'birthday_cake_rugby_tackle',
    category: 'funny',
    weight: 1,
    minAge: 8,
    maxAge: 10,
    cooldownQuarters: 99,
    once: true,
    text: 'A friend\'s birthday cake was rugby-tackled by a younger sibling and the candles never stood a chance.',
    effects: { hidden: { confidence: 1 } },
  },
  {
    id: 'lost_in_a_supermarket',
    category: 'funny',
    weight: 1,
    minAge: 8,
    maxAge: 9,
    cooldownQuarters: 99,
    once: true,
    text: '{name} wandered off in a supermarket and was found calmly reading cereal boxes.',
    effects: { hidden: { confidence: -1 } },
  },
  {
    id: 'teacher_picked_wrong_name',
    category: 'funny',
    weight: 1,
    minAge: 8,
    maxAge: 10,
    cooldownQuarters: 5,
    text: 'A substitute teacher called {name} by the wrong name for an entire afternoon.',

    choices: [
    { id: 'correct_quietly', label: "Correct the teacher quietly after class", effects: {"hidden": {"workEthic": 1}} },
    { id: 'go_with_it', label: "Go with it for the whole day", effects: {"hidden": {"confidence": -1}} }
  ],    effects: { hidden: { confidence: -1 } },
  },
  {
    id: 'water_bottle_explosion',
    category: 'funny',
    weight: 1,
    minAge: 8,
    maxAge: 10,
    cooldownQuarters: 5,
    text: 'A water bottle burst in a school bag and the homework got a wash it did not need.',

    choices: [
    { id: 'clean_up', label: "Own the mess and clean it up", effects: {"hidden": {"workEthic": 1}} },
    { id: 'blame_bag', label: "Blame a leaky bag and move on", effects: {} }
  ],    effects: { hidden: { confidence: 1 } },
  },
  {
    id: 'wore_two_different_shoes',
    category: 'funny',
    weight: 1,
    minAge: 8,
    maxAge: 10,
    cooldownQuarters: 6,
    text: 'In a sleepy rush {name} walked out of the door in two very different shoes.',

    choices: [
    { id: 'own_it', label: "Own the mismatched shoes for the day", effects: {"hidden": {"confidence": -1}} },
    { id: 'hide_it', label: "Hide at the back of the line all day", effects: {"hidden": {"confidence": -1}} }
  ],    effects: { hidden: { confidence: -1 } },
  },
  {
    id: 'autograph_request_mixup',
    category: 'funny',
    weight: 1,
    minAge: 8,
    maxAge: 10,
    cooldownQuarters: 99,
    once: true,
    requiresClub: true,
    text: 'A fan asked for {name}\'s autograph after a match and it turned out to be a different kid.',

    choices: [
    { id: 'sign_it_anyway', label: "Sign it anyway with a grin", effects: {"hidden": {"confidence": 1}} },
    { id: 'clarify', label: "Tell the fan it is actually the other kid", effects: {"hidden": {"confidence": 1}} }
  ],    effects: { hidden: { confidence: 1 } },
  },

  // --- rare (ages 8-10) ---
  {
    id: 'club_open_day_invite',
    category: 'rare',
    weight: 1,
    minAge: 8,
    maxAge: 10,
    cooldownQuarters: 99,
    once: true,
    text: 'An invite to a club open day arrived with a free t-shirt inside.',

    choices: [
    { id: 'go_alone', label: "Go alone and chat with everyone", effects: {"hidden": {"confidence": 2}} },
    { id: 'go_with_friend', label: "Go with a friend for moral support", effects: {"hidden": {"confidence": 1}} }
  ],    effects: { hidden: { confidence: 2 } },
  },

  // ===================================================================
  // AGES 11-13 (12 events)
  // ===================================================================

  // --- school ---
  {
    id: 'moving_to_secondary_school',
    category: 'school',
    weight: 2,
    minAge: 11,
    maxAge: 13,
    cooldownQuarters: 99,
    once: true,
    text: 'The move to a new secondary school was looming and the form-filling pile grew by the day.',
    choices: [
      { id: 'choose_friends', label: 'Pick a school where friends are going', effects: { hidden: { confidence: 1 } } },
      { id: 'choose_subjects', label: 'Pick a school with the best subject options', effects: { hidden: { workEthic: 1 } } },
    ],
  },
  {
    id: 'first_secondary_school_day',
    category: 'school',
    weight: 1,
    minAge: 11,
    maxAge: 13,
    cooldownQuarters: 99,
    once: true,
    text: 'A first day at the big school with a massive map and a brand new timetable.',
    effects: { hidden: { confidence: 1, workEthic: 1 } },
  },
  {
    id: 'subject_choice_meeting',
    category: 'school',
    weight: 1,
    minAge: 12,
    maxAge: 13,
    cooldownQuarters: 6,
    text: 'A meeting at school asked for choices about which subjects to take next year.',

    choices: [
    { id: 'speak_up', label: "Speak up about what you want", effects: {"hidden": {"confidence": 2}} },
    { id: 'go_along', label: "Go along with the parent suggestion", effects: {"hidden": {"workEthic": 1}} }
  ],    effects: { hidden: { workEthic: 1 } },
  },
  {
    id: 'homework_deadline_scare',
    category: 'school',
    weight: 1,
    minAge: 11,
    maxAge: 13,
    cooldownQuarters: 5,
    text: 'A homework deadline appeared faster than expected and {name} had a long evening.',
    choices: [
      { id: 'pull_all_nighter', label: 'Push through the whole evening', effects: { hidden: { workEthic: 1, fatigue: 4 } } },
      { id: 'ask_extension', label: 'Ask for a small extension', effects: { hidden: { workEthic: -1, confidence: 1 } } },
    ],
  },
  {
    id: 'secondary_school_clubs_fair',
    category: 'school',
    weight: 1,
    minAge: 11,
    maxAge: 13,
    cooldownQuarters: 4,
    text: 'A clubs fair in the school hall had stands for everything from chess to robotics.',
    choices: [
      { id: 'join_two', label: 'Sign up for two new clubs', effects: { hidden: { confidence: 1, workEthic: 1, fatigue: 2 } } },
      { id: 'keep_focus', label: 'Stay focused on football and school', effects: { hidden: { workEthic: 2 } } },
    ],
  },

  // --- life (ages 11-13) ---
  {
    id: 'first_long_train_journey',
    category: 'life',
    weight: 1,
    minAge: 11,
    maxAge: 13,
    cooldownQuarters: 99,
    once: true,
    text: '{name} took a long train journey alone to visit a relative and read a book the whole way.',
    effects: { hidden: { confidence: 2, workEthic: 1 } },
  },
  {
    id: 'paper_round_started',
    category: 'life',
    weight: 1,
    minAge: 12,
    maxAge: 13,
    cooldownQuarters: 99,
    once: true,
    text: 'A paper round started at the weekend and the early mornings took some getting used to.',
    choices: [
      { id: 'early_bird', label: 'Get up at first light and crack on', effects: { hidden: { workEthic: 3 } } },
      { id: 'morning_grump', label: 'Grumble through the first week', effects: { hidden: { workEthic: 1, fatigue: 2 } } },
    ],
  },
  {
    id: 'first_phone_with_a_plan',
    category: 'life',
    weight: 1,
    minAge: 11,
    maxAge: 13,
    cooldownQuarters: 99,
    once: true,
    text: 'A phone with a real monthly plan arrived and the group chat never slept.',
    effects: { hidden: { confidence: 1 } },
  },
  {
    id: 'helps_with_household_repair',
    category: 'life',
    weight: 1,
    minAge: 11,
    maxAge: 13,
    cooldownQuarters: 5,
    text: '{name} held a flashlight and passed tools for a household repair job.',

    choices: [
    { id: 'steady_hands', label: "Hold the flashlight with steady hands", effects: {"hidden": {"workEthic": 2}} },
    { id: 'try_too_much', label: "Try to help with a screwdriver too", effects: {"hidden": {"workEthic": 1}} }
  ],    effects: { hidden: { workEthic: 2 } },
  },

  // --- football (ages 11-13) ---
  {
    id: 'secondary_school_team_trials',
    category: 'football',
    weight: 2,
    minAge: 11,
    maxAge: 13,
    cooldownQuarters: 4,
    requiresClub: true,
    text: 'Trials for the secondary school team brought bigger pitches and bigger voices.',

    choices: [
    { id: 'lead', label: "Lead from the front of the trial", effects: {"stats": {"pace": 1}, "hidden": {"confidence": 1, "fatigue": 3}} },
    { id: 'steady', label: "Put in a steady trial performance", effects: {"hidden": {"fatigue": 3}} }
  ],    effects: { stats: { pace: 1 }, hidden: { confidence: 1, fatigue: 3 } },
  },
  {
    id: 'first_team_substitution',
    category: 'football',
    weight: 1,
    minAge: 11,
    maxAge: 13,
    cooldownQuarters: 6,
    requiresClub: true,
    text: 'The coach signalled for {name} to come on and the touchline felt very far away.',

    choices: [
    { id: 'impact', label: "Make an immediate impact", effects: {"stats": {"pace": 1}, "hidden": {"confidence": 2}} },
    { id: 'settle', label: "Settle in for the first few minutes", effects: {"hidden": {"fatigue": 1}} }
  ],    effects: { hidden: { confidence: 2 } },
  },
  {
    id: 'first_red_card_fear',
    category: 'football',
    weight: 1,
    minAge: 12,
    maxAge: 13,
    cooldownQuarters: 99,
    once: true,
    requiresClub: true,
    text: 'A clumsy tackle almost brought a red card and {name} played the next ten minutes very carefully.',
    effects: { hidden: { confidence: -1, workEthic: 1 } },
  },

  // ===================================================================
  // AGES 14-16 (8 events)
  // ===================================================================

  // --- school ---
  {
    id: 'gcse_mock_revision',
    category: 'school',
    weight: 1,
    minAge: 14,
    maxAge: 16,
    cooldownQuarters: 4,
    text: 'Mock exams meant a long stretch of evening revision at the kitchen table.',
    choices: [
      { id: 'study_plan', label: 'Follow a written study plan', effects: { hidden: { workEthic: 3 } } },
      { id: 'cram_each_night', label: 'Cram the night before each mock', effects: { hidden: { workEthic: 1, fatigue: 4 } } },
    ],
  },
  {
    id: 'work_experience_week',
    category: 'school',
    weight: 1,
    minAge: 14,
    maxAge: 16,
    cooldownQuarters: 99,
    once: true,
    text: 'A work experience week was arranged and {name} tried a real working day for the first time.',

    choices: [
    { id: 'ask_questions', label: "Ask questions of every adult in the room", effects: {"hidden": {"workEthic": 2, "confidence": 1}} },
    { id: 'quiet_work', label: "Get on with quiet work and listen", effects: {"hidden": {"workEthic": 2}} }
  ],    effects: { hidden: { workEthic: 2, confidence: 1 } },
  },
  {
    id: 'final_year_decisions',
    category: 'school',
    weight: 1,
    minAge: 15,
    maxAge: 16,
    cooldownQuarters: 6,
    text: 'Decisions about next steps beyond school needed to be made sooner than expected.',

    choices: [
    { id: 'talk_to_parents', label: "Talk it through with the family", effects: {"hidden": {"confidence": 1}} },
    { id: 'quiet_think', label: "Take a quiet walk and think it through", effects: {"hidden": {"workEthic": 1}} }
  ],    effects: { hidden: { workEthic: 1 } },
  },

  // --- life (ages 14-16) ---
  {
    id: 'first_long_bike_ride',
    category: 'life',
    weight: 1,
    minAge: 14,
    maxAge: 16,
    cooldownQuarters: 6,
    text: '{name} planned a long bike ride with friends and the hill in the middle was much steeper than expected.',
    choices: [
      { id: 'push_to_top', label: 'Push to the top without stopping', effects: { stats: { pace: 1 }, hidden: { fatigue: 4 } } },
      { id: 'rest_halfway', label: 'Pause halfway and chat', effects: { hidden: { confidence: 1, fatigue: 2 } } },
    ],
  },
  {
    id: 'part_time_weekend_job',
    category: 'life',
    weight: 1,
    minAge: 14,
    maxAge: 16,
    cooldownQuarters: 99,
    once: true,
    text: 'A part-time weekend job started and the pay packet felt heavier than it was.',
    effects: { hidden: { workEthic: 2, fatigue: 3 } },
  },
  {
    id: 'first_long_train_journey_alone',
    category: 'life',
    weight: 1,
    minAge: 15,
    maxAge: 16,
    cooldownQuarters: 99,
    once: true,
    text: 'A long train journey alone was planned with a backpack, snacks, and a destination.',
    effects: { hidden: { confidence: 2, workEthic: 1 } },
  },

  // --- football (ages 14-16) ---
  {
    id: 'first_captain_armband',
    category: 'football',
    weight: 1,
    minAge: 14,
    maxAge: 16,
    cooldownQuarters: 99,
    once: true,
    requiresClub: true,
    text: 'The coach handed {name} the captain\'s armband for a single match as a trial.',

    choices: [
    { id: 'lead_loudly', label: "Lead the team loudly from the front", effects: {"hidden": {"confidence": 3, "workEthic": 1}} },
    { id: 'lead_by_example', label: "Lead by example on the ball", effects: {"stats": {"passing": 1}, "hidden": {"confidence": 2}} }
  ],    effects: { hidden: { confidence: 3, workEthic: 1 } },
  },
  {
    id: 'first_pre_contract_interest',
    category: 'football',
    weight: 1,
    minAge: 15,
    maxAge: 16,
    cooldownQuarters: 99,
    once: true,
    requiresClub: true,
    text: 'A representative from a senior squad asked to chat with {name} after a match.',
    effects: { hidden: { confidence: 3 } },
  },

  // ===================================================================
  // MULTI-BAND CROSS-CUTTING (25 events)
  // ===================================================================

  // --- school cross-band ---
  {
    id: 'homework_lost_in_a_bag',
    category: 'school',
    weight: 1,
    minAge: 7,
    maxAge: 13,
    cooldownQuarters: 5,
    text: 'A homework sheet disappeared into the bottom of a school bag and was found crumpled days later.',
    choices: [
      { id: 'redo_quickly', label: 'Redo the homework as quickly as possible', effects: { hidden: { workEthic: 1, fatigue: 2 } } },
      { id: 'explain_to_teacher', label: 'Tell the teacher what happened and ask for help', effects: { hidden: { confidence: 1 } } },
    ],
  },
  {
    id: 'school_photo_grows_up',
    category: 'school',
    weight: 1,
    minAge: 8,
    maxAge: 16,
    cooldownQuarters: 99,
    once: true,
    text: 'Looking at last year\'s class photo {name} realised how much had changed in twelve months.',

    choices: [
    { id: 'reflect', label: "Spend a quiet moment reflecting", effects: {"hidden": {"workEthic": 1}} },
    { id: 'share', label: "Share the realisation with a friend", effects: {"hidden": {"confidence": 1}} }
  ],    effects: { hidden: { confidence: 1 } },
  },
  {
    id: 'science_fair_question',
    category: 'school',
    weight: 1,
    minAge: 9,
    maxAge: 16,
    cooldownQuarters: 4,
    text: 'A teacher asked a tricky science question and the room waited for an answer.',

    choices: [
    { id: 'answer', label: "Put a hand up and try to answer", effects: {"hidden": {"confidence": 2}} },
    { id: 'think_aloud', label: "Think aloud with a classmate first", effects: {"hidden": {"confidence": 1, "workEthic": 1}} }
  ],    effects: { hidden: { confidence: 1, workEthic: 1 } },
  },
  {
    id: 'helps_a_younger_student',
    category: 'school',
    weight: 1,
    minAge: 9,
    maxAge: 16,
    cooldownQuarters: 5,
    text: '{name} helped a younger student with a tricky bit of classwork at break time.',

    choices: [
    { id: 'patient', label: "Be patient and explain twice if needed", effects: {"hidden": {"workEthic": 2, "confidence": 1}} },
    { id: 'quick_help', label: "Help quickly and get back to break", effects: {"hidden": {"workEthic": 1}} }
  ],    effects: { hidden: { workEthic: 2, confidence: 1 } },
  },
  {
    id: 'school_library_quiet_afternoon',
    category: 'school',
    weight: 1,
    minAge: 8,
    maxAge: 16,
    cooldownQuarters: 6,
    text: 'A long quiet afternoon in the library let {name} get ahead on reading.',

    choices: [
    { id: 'deep_read', label: "Settle into one deep read", effects: {"hidden": {"workEthic": 2}} },
    { id: 'skim_three', label: "Skim three different books", effects: {"hidden": {"workEthic": 1}} }
  ],    effects: { hidden: { workEthic: 2 } },
  },

  // --- life cross-band ---
  {
    id: 'first_long_walk_alone',
    category: 'life',
    weight: 1,
    minAge: 8,
    maxAge: 13,
    cooldownQuarters: 6,
    text: '{name} planned a long walk alone and ended up exploring a new corner of the neighbourhood.',

    choices: [
    { id: 'map', label: "Plan a route on a map first", effects: {"hidden": {"confidence": 2}} },
    { id: 'wander', label: "Just wander and find your way home", effects: {"hidden": {"workEthic": 1}} }
  ],    effects: { hidden: { confidence: 2 } },
  },
  {
    id: 'gets_a_new_bicycle',
    category: 'life',
    weight: 1,
    minAge: 8,
    maxAge: 13,
    cooldownQuarters: 99,
    once: true,
    text: 'A bigger bicycle arrived and the old one was passed down to a younger cousin.',

    choices: [
    { id: 'name_it', label: "Name the bicycle straight away", effects: {"hidden": {"confidence": 2}} },
    { id: 'quiet_ride', label: "Take a quiet first ride around the block", effects: {"hidden": {"workEthic": 1}} }
  ],    effects: { hidden: { confidence: 2 } },
  },
  {
    id: 'family_holiday_disruption',
    category: 'life',
    weight: 1,
    minAge: 8,
    maxAge: 16,
    cooldownQuarters: 99,
    once: true,
    text: 'A planned family holiday was cancelled and the family improvised a staycation instead.',
    choices: [
      { id: 'embrace_staycation', label: 'Embrace the staycation and make the most of it', effects: { hidden: { confidence: 1 } } },
      { id: 'mope_about', label: 'Spend the week quietly moping', effects: { hidden: { confidence: -1 } } },
    ],
  },
  {
    id: 'learns_to_cook_a_meal',
    category: 'life',
    weight: 1,
    minAge: 9,
    maxAge: 16,
    cooldownQuarters: 6,
    text: '{name} cooked a full meal for the family for the first time.',
    choices: [
      { id: 'familiar_recipe', label: 'Cook a familiar recipe with help nearby', effects: { hidden: { workEthic: 2 } } },
      { id: 'new_recipe', label: 'Try a brand new recipe solo', effects: { hidden: { workEthic: 1, confidence: 2 } } },
    ],
  },
  {
    id: 'first_overnight_at_a_friend',
    category: 'life',
    weight: 1,
    minAge: 7,
    maxAge: 12,
    cooldownQuarters: 6,
    text: 'An overnight at a friend\'s house involved a midnight snack and a long whispered chat.',

    choices: [
    { id: 'join_in_games', label: "Join every game the friend suggests", effects: {"hidden": {"confidence": 1, "fatigue": 1}} },
    { id: 'quieter_evening', label: "Suggest a quieter evening in", effects: {"hidden": {"workEthic": 1}} }
  ],    effects: { hidden: { confidence: 1, fatigue: 1 } },
  },
  {
    id: 'first_real_responsibility',
    category: 'life',
    weight: 1,
    minAge: 10,
    maxAge: 16,
    cooldownQuarters: 6,
    text: 'A parent handed over a small piece of household responsibility and {name} stepped up.',

    choices: [
    { id: 'eager', label: "Take it on eagerly", effects: {"hidden": {"workEthic": 2, "confidence": 1}} },
    { id: 'cautious', label: "Take it on carefully", effects: {"hidden": {"workEthic": 1}} }
  ],    effects: { hidden: { workEthic: 2, confidence: 1 } },
  },
  {
    id: 'gets_first_winter_coat',
    category: 'life',
    weight: 1,
    minAge: 7,
    maxAge: 12,
    cooldownQuarters: 99,
    once: true,
    text: 'A new winter coat arrived just in time for the first cold snap of the season.',

    choices: [
    { id: 'bright', label: "Pick a bright coat on purpose", effects: {"hidden": {"confidence": 1}} },
    { id: 'practical', label: "Pick a sensible coat for the weather", effects: {"hidden": {"workEthic": 1}} }
  ],    effects: { hidden: { confidence: 1 } },
  },
  {
    id: 'household_pet_passes_away',
    category: 'life',
    weight: 1,
    minAge: 8,
    maxAge: 16,
    cooldownQuarters: 99,
    once: true,
    text: 'A much-loved household pet had to be put to sleep and the house felt emptier.',

    choices: [
    { id: 'memorial', label: "Make a small memorial at home", effects: {"hidden": {"workEthic": 1}} },
    { id: 'quiet_grief', label: "Stay quiet and let the family grieve together", effects: {"hidden": {"confidence": -1}} }
  ],    effects: { hidden: { confidence: -2 } },
  },
  {
    id: 'family_gets_new_pet',
    category: 'life',
    weight: 1,
    minAge: 8,
    maxAge: 14,
    cooldownQuarters: 99,
    once: true,
    text: 'A new small pet came home in a cardboard box and the household routines shifted around it.',

    choices: [
    { id: 'lead_care', label: "Take the lead on care duties", effects: {"hidden": {"workEthic": 1, "confidence": 1}} },
    { id: 'share_duties', label: "Share the new pet duties with siblings", effects: {"hidden": {"workEthic": 1}} }
  ],    effects: { hidden: { workEthic: 1, confidence: 1 } },
  },
  {
    id: 'helps_with_school_pickup',
    category: 'life',
    weight: 1,
    minAge: 10,
    maxAge: 16,
    cooldownQuarters: 5,
    text: '{name} helped a parent with the school pickup of a younger sibling on a busy afternoon.',

    choices: [
    { id: 'chat', label: "Chat with the younger sibling the whole walk", effects: {"hidden": {"workEthic": 2}} },
    { id: 'focused', label: "Focus on getting home quickly", effects: {"hidden": {"workEthic": 1}} }
  ],    effects: { hidden: { workEthic: 2 } },
  },

  // --- football cross-band ---
  {
    id: 'training_missed_for_school_event',
    category: 'football',
    weight: 1,
    minAge: 8,
    maxAge: 16,
    cooldownQuarters: 5,
    requiresClub: true,
    text: 'Training clashed with a school event and {name} had to choose which to attend.',
    choices: [
      { id: 'go_school', label: 'Go to the school event and email the coach', effects: { hidden: { workEthic: 1 } } },
      { id: 'go_training', label: 'Sneak in training and catch up on school later', effects: { hidden: { workEthic: -1, confidence: 1 } } },
    ],
  },
  {
    id: 'first_match_loss',
    category: 'football',
    weight: 1,
    minAge: 8,
    maxAge: 16,
    cooldownQuarters: 4,
    requiresClub: true,
    text: 'A heavy match loss stung and the changing room was very quiet.',
    effects: { hidden: { confidence: -1, workEthic: 2 } },
  },
  {
    id: 'long_bus_trip_to_away_match',
    category: 'football',
    weight: 1,
    minAge: 9,
    maxAge: 16,
    cooldownQuarters: 4,
    requiresClub: true,
    text: 'A long bus trip to an away match meant snacks, songs, and tired legs on arrival.',

    choices: [
    { id: 'nap', label: "Catch a quick nap on the bus", effects: {"hidden": {"fatigue": -2}} },
    { id: 'song_sing', label: "Lead the singing all the way down", effects: {"hidden": {"confidence": 1}} }
  ],    effects: { hidden: { fatigue: 3 } },
  },
  {
    id: 'wins_practice_match_with_friend',
    category: 'football',
    weight: 1,
    minAge: 7,
    maxAge: 13,
    cooldownQuarters: 6,
    text: 'A small practice match at the park finished with a winner and lots of laughing.',

    choices: [
    { id: 'winner_stay_on', label: "Play winner-stays-on for an hour", effects: {"stats": {"passing": 1}, "hidden": {"confidence": 1, "fatigue": 1}} },
    { id: 'move_on', label: "Move on to a different game", effects: {} }
  ],    effects: { stats: { passing: 1 }, hidden: { confidence: 1, fatigue: 1 } },
  },
  {
    id: 'new_position_exploration',
    category: 'football',
    weight: 1,
    minAge: 10,
    maxAge: 16,
    cooldownQuarters: 5,
    requiresClub: true,
    text: 'The coach asked {name} to spend a week trying a new position to learn the game from the other side.',

    choices: [
    { id: 'embrace', label: "Embrace the new position for the week", effects: {"hidden": {"workEthic": 2}} },
    { id: 'compare', label: "Compare the two positions at the end", effects: {"hidden": {"workEthic": 1}} }
  ],    effects: { hidden: { workEthic: 1 } },
  },
  {
    id: 'first_match_hat_trick',
    category: 'football',
    weight: 1,
    minAge: 10,
    maxAge: 16,
    cooldownQuarters: 99,
    once: true,
    requiresClub: true,
    text: '{name} scored three goals in a single match and the team lifted them up after the final whistle.',

    choices: [
    { id: 'celebrate_team', label: "Celebrate with the whole team", effects: {"stats": {"shooting": 2}, "hidden": {"confidence": 3}} },
    { id: 'quiet_thanks', label: "Quietly thank the team for the assists", effects: {"hidden": {"workEthic": 1}} }
  ],    effects: { stats: { shooting: 2 }, hidden: { confidence: 3 } },
  },

  // --- funny cross-band ---
  {
    id: 'celebrates_too_early',
    category: 'funny',
    weight: 1,
    minAge: 8,
    maxAge: 16,
    cooldownQuarters: 6,
    requiresClub: true,
    text: '{name} celebrated what they thought was a goal and the ball was actually still in play.',

    choices: [
    { id: 'laugh_off', label: "Laugh it off and carry on", effects: {"hidden": {"confidence": 1}} },
    { id: 'hide_blush', label: "Hide the blush and get on with it", effects: {"hidden": {"confidence": -1}} }
  ],    effects: { hidden: { confidence: -1 } },
  },
  {
    id: 'wrong_kit_day',
    category: 'funny',
    weight: 1,
    minAge: 8,
    maxAge: 16,
    cooldownQuarters: 6,
    requiresClub: true,
    text: '{name} arrived at training in the wrong coloured kit and had to borrow a spare shirt.',

    choices: [
    { id: 'own_it', label: "Own the wrong kit and play well anyway", effects: {"hidden": {"confidence": 1}} },
    { id: 'apology', label: "Apologise to the kit manager", effects: {"hidden": {"workEthic": 1}} }
  ],    effects: { hidden: { confidence: -1 } },
  },
  {
    id: 'goalkeeper_kick_in_their_own_face',
    category: 'funny',
    weight: 1,
    minAge: 9,
    maxAge: 16,
    cooldownQuarters: 8,
    requiresClub: true,
    text: 'A goalkeeper clearance caught the wind and the ball hit the kicker straight in the face.',

    choices: [
    { id: 'shake_off', label: "Shake it off and carry on", effects: {"hidden": {"confidence": 1}} },
    { id: 'bench', label: "Ask for a sub to recover", effects: {"hidden": {"fatigue": 1}} }
  ],    effects: { hidden: { confidence: -1 } },
  },

  // --- rare cross-band ---
  {
    id: 'professional_team_visit_to_club',
    category: 'rare',
    weight: 1,
    minAge: 9,
    maxAge: 16,
    cooldownQuarters: 99,
    once: true,
    requiresClub: true,
    text: 'A senior professional team came to watch training and {name} was pulled out for a quick chat.',

    choices: [
    { id: 'chat', label: "Ask the pro questions and listen", effects: {"hidden": {"confidence": 3}} },
    { id: 'just_train', label: "Just train as normal and hope they notice", effects: {"hidden": {"workEthic": 1}} }
  ],    effects: { hidden: { confidence: 3 } },
  },
  {
    id: 'small_local_news_mention',
    category: 'rare',
    weight: 1,
    minAge: 10,
    maxAge: 16,
    cooldownQuarters: 99,
    once: true,
    requiresClub: true,
    text: 'A short mention of a recent goal appeared in the local paper under the youth round-up.',

    choices: [
    { id: 'share_news', label: "Share the article with everyone", effects: {"hidden": {"confidence": 2}} },
    { id: 'quiet_pride', label: "Take quiet pride and get on with training", effects: {"hidden": {"workEthic": 1}} }
  ],    effects: { hidden: { confidence: 2 } },
  },
];

export function eventsByCategory(category) {
  return EVENTS.filter((e) => e.category === category);
}