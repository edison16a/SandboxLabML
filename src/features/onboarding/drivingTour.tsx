import { CarFront, Code2, Cpu, Dna } from 'lucide-react';
import { useDrivingLab } from '@/features/driving/state/labStore';
import type { Tour } from '@/ui/walkthrough/types';
import { drivingFlatOut, keepDrivingTraining, watchDrivingLive } from './drivingTourActions';

const LEARN = 'How it learns';
const DRIVE = 'How it drives';
const YOURS = 'Your turn';
const lab = () => useDrivingLab.getState();

/**
 * The Driving lab tour. The first half explains training and the levels,
 * the second what a trained network senses and does. A few steps wait for
 * the user to press the real control, then explain what it set going.
 */
export const DRIVING_TOUR: Tour = {
  id: 'driving',
  storageKey: 'sandboxlab.tour.driving',
  // Escape takes the camera back from a clicked SUV or ghost to the leader.
  pageOwnsEscape: () => lab().focus.kind !== 'champion',
  intro: {
    title: 'Welcome to the Self-driving lab',
    body: 'These SUVs teach themselves to drive through a city. First how they learn, then how a trained one drives.',
    icon: <CarFront />,
    chapters: [
      { label: LEARN, icon: <Dna /> },
      { label: DRIVE, icon: <Cpu /> },
      { label: YOURS, icon: <Code2 /> },
    ],
  },
  steps: [
    {
      id: 'train',
      chapter: LEARN,
      target: '[data-tour="train"]',
      prefer: ['top', 'right'],
      title: 'Every SUV has a brain',
      body: 'A small neural network drives each SUV. It starts random, so it drives badly.',
      action: {
        prompt: 'Press Train',
        shortcut: 'Space',
        done: () => lab().status === 'running',
        doneLabel: 'Training',
        then: {
          target: '[data-tour="viewport"]',
          title: 'Fitness is the score',
          body: 'Each SUV scores for new ground on its route, and most for arriving. Hitting anything, leaving the road, a wrong turn or a red light ends its trip.',
        },
      },
    },
    {
      id: 'parents',
      chapter: LEARN,
      target: '[data-tour="generation"]',
      // A narrow toolbar hides its counter, but the viewport always shows one.
      fallback: '[data-tour="hud-generation"]',
      prefer: ['top'],
      prepare: () => void keepDrivingTraining(),
      title: 'The best become parents',
      body: 'When every SUV is done, the best ones breed the next generation. Their children are copies or mixes of them, with small changes.',
      terms: [
        { term: 'Mutation', meaning: 'Small random changes. Weights shift, and sometimes a new link or neuron appears.' },
        { term: 'Crossover', meaning: 'A child that mixes the links of two parents.' },
      ],
    },
    {
      id: 'levels',
      chapter: LEARN,
      target: '[data-tour="hud-level"]',
      fallback: '[data-tour="viewport"]',
      prefer: ['bottom', 'right'],
      prepare: () => void keepDrivingTraining(),
      title: 'One level at a time',
      body: 'Training starts on empty streets. When half of the best fifth arrives safely, averaged over three generations, the city adds traffic lights, then people, traffic and rush hour.',
      terms: [{ term: 'Curriculum', meaning: 'Lessons in order, each a little harder than the last.' }],
    },
    {
      id: 'progress',
      chapter: LEARN,
      target: '[data-tour="curriculum"]',
      fallback: '[data-tour="panel"]',
      prefer: ['left'],
      prepare: () => lab().set({ panelTab: 'progress' }),
      title: 'Watch it climb',
      body: 'The level steps up as safe arrivals rise. A new level dips at first, then the brains catch up.',
    },
    {
      id: 'speed',
      chapter: LEARN,
      target: '[data-tour="speed"]',
      prefer: ['top'],
      prepare: () => void keepDrivingTraining(),
      title: 'Train faster',
      body: '1x to 4x let you watch. Turbo and Max train flat out on every core.',
      action: {
        // No shortcut shown: its key is 4, which reads as the 4x button right beside Turbo.
        prompt: 'Pick Turbo',
        done: drivingFlatOut,
        doneLabel: 'Training flat out',
        then: {
          title: 'Learning in the background',
          body: 'Generations now finish in seconds while past champions drive on screen. Next, back to 1x to watch one SUV.',
        },
      },
    },
    {
      id: 'inputs',
      chapter: DRIVE,
      target: '[data-tour="inputs"]',
      prefer: ['bottom', 'left'],
      prepare: () => void watchDrivingLive(),
      title: 'A network only sees numbers',
      body: 'A network starts from its inputs. Press Inputs to draw what the followed SUV senses.',
      action: {
        prompt: 'Press Inputs',
        shortcut: 'I',
        done: () => lab().inputsOverlay,
        doneLabel: 'Inputs on',
        then: {
          target: '[data-tour="viewport"]',
          title: 'What the SUV senses',
          body: 'Lidar beams, its lane and route, the light it reads, and the cars and people near its path. The arrows show where it will be in the next few seconds.',
          terms: [{ term: 'Lidar', meaning: 'Beams that measure how far away the nearest thing is in each direction.' }],
        },
      },
    },
    {
      id: 'camera',
      chapter: DRIVE,
      target: '[data-tour="camera"]',
      prefer: ['bottom', 'left'],
      title: 'Pick a camera',
      body: 'Chase follows the best SUV. Corner waits at the next junction, and top down follows from straight above. C cycles them.',
    },
    {
      id: 'network',
      chapter: DRIVE,
      target: '[data-tour="tab-network"]',
      prefer: ['left', 'bottom'],
      prepare: () => void watchDrivingLive(),
      title: 'Look inside the brain',
      body: 'The Network tab shows the brain of the SUV you follow.',
      action: {
        prompt: 'Open the Network tab',
        done: () => lab().panelTab === 'network',
        doneLabel: 'Network open',
        then: {
          target: '[data-tour="panel"]',
          title: 'This is the model running',
          body: 'Every tick, inputs on the left flow through the links to steering and pedal on the right. Busy links light up.',
          terms: [
            { term: 'Weight', meaning: 'How strongly a link passes its signal. Blue keeps the sign, orange flips it.' },
            { term: 'Hidden neuron', meaning: 'A neuron between inputs and outputs. Mutation adds them, so networks grow deeper as they learn.' },
          ],
        },
      },
    },
    {
      id: 'ghosts',
      chapter: DRIVE,
      target: '[data-tour="view"]',
      prefer: ['bottom', 'left'],
      title: 'Ghosts of past champions',
      body: 'Overlay and Both replay earlier champions on the same streets. The gap between them is what training bought.',
    },
    {
      id: 'sandbox',
      chapter: DRIVE,
      target: '[data-tour="sandbox"]',
      prefer: ['top'],
      title: 'Drive them anywhere',
      body: 'The Sandbox puts your champions on any city, level and route. Before you train, it drives a trained model so you can see where this goes.',
    },
    {
      id: 'studio',
      chapter: YOURS,
      target: '[data-tour="nav-studio"]',
      prefer: ['bottom'],
      title: 'Write the rules yourself',
      body: 'In the Studio you write the training script: what earns fitness and when a trip ends. The lessons show you how. Replay this tour from the ? button.',
      links: [{ label: 'Start the first lesson', href: '/studio?lesson=driving-01-first-trip' }],
    },
  ],
};
