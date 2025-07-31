import { IntroScene } from '../scenes/IntroScene';
import { CreateTaskScene } from '../scenes/CreateTaskScene';
import { PlanScene } from '../scenes/PlanScene';
import { ExecuteScene } from '../scenes/ExecuteScene';
import { ReviewScene } from '../scenes/ReviewScene';
import { OutroScene } from '../scenes/OutroScene';

export const SCENES = [
  { Component: IntroScene, length: 60, name: 'Intro' },
  { Component: CreateTaskScene, length: 200, name: 'Create Task' },
  { Component: PlanScene, length: 125, name: 'Plan' },
  { Component: ExecuteScene, length: 125, name: 'Execute' },
  { Component: ReviewScene, length: 125, name: 'Review' },
  { Component: OutroScene, length: 100, name: 'Outro' },
] as const;

// Calculate total duration
export const TOTAL_DURATION = SCENES.reduce((acc, scene) => acc + scene.length, 0);

// Helper to get scene timing
export const getSceneTiming = () => {
  let currentFrame = 0;
  return SCENES.map((scene) => {
    const timing = {
      ...scene,
      from: currentFrame,
      to: currentFrame + scene.length,
    };
    currentFrame += scene.length;
    return timing;
  });
};