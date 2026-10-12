// The rest-day stretch routine: about ten minutes, no equipment, nothing that needs a spotter.

export interface StretchMove {
  name: string;
  how: string;
  time: string;
}

export const STRETCH_ROUTINE: StretchMove[] = [
  { name: "Child’s pose", how: "Kneel, sit back on your heels and reach your arms forward. Breathe slowly.", time: "60 s" },
  { name: "Cat and cow", how: "On hands and knees, round your back then lift your chest. Move with your breath.", time: "10 slow reps" },
  { name: "Hip flexor lunge", how: "Half-kneel, tuck your hips under and lean forward until the front of the hip stretches.", time: "45 s each side" },
  { name: "Seated hamstring reach", how: "Sit with one leg straight and reach toward your toes with a flat back.", time: "45 s each side" },
  { name: "Standing quad stretch", how: "Hold your ankle behind you, knees together, hips tucked. Hold a wall if you need to.", time: "30 s each side" },
  { name: "Doorway chest stretch", how: "Forearm on the door frame, step through until the chest opens.", time: "45 s each side" },
  { name: "Cross-body shoulder", how: "Pull one arm across your chest with the other hand. Keep your shoulders down.", time: "30 s each side" },
  { name: "Slow breathing", how: "Lie on your back, knees bent. Breathe in for 4, out for 6.", time: "60 s" },
];
