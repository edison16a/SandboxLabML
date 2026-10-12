import { Car, Code2, Cpu, Dna } from 'lucide-react';
import { useRacingLab } from '@/features/racing/state/labStore';
import type { Tour } from '@/ui/walkthrough/types';
import { keepRacingTraining, racingFlatOut, watchRacingLive } from './tourActions';

const LEARN = 'How it learns';
const DRIVE = 'How it drives';
const YOURS = 'Your turn';
const lab = () => useRacingLab.getState();

/**
 * The Racing lab tour. The first half explains training, the second how a
 * trained network runs. A few steps wait for the user to press the real
 * control, then explain what it set going.
 */
export const RACING_TOUR: Tour = {
  id: 'racing',
  storageKey: 'sandboxlab.tour.racing',
  // Escape takes the camera back from a clicked car or ghost to the champion.
  pageOwnsEscape: () => lab().focus.kind !== 'champion',
  intro: {
    title: 'Welcome to the Racing lab',
    body: 'These cars teach themselves to drive. First how they learn, then how a trained one drives.',
    icon: <Car />,
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
      title: 'Every car has a brain',
      body: 'A small neural network drives each car. It starts random, so it drives badly.',
      action: {
        prompt: 'Press Train',
        shortcut: 'Space',
        done: () => lab().status === 'running',
        doneLabel: 'Training',
        then: {
          target: '[data-tour="viewport"]',
          title: 'Fitness is the score',
          body: 'Each car scores fitness for how far it gets, plus a little for speed. A crash ends its run.',
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
      prepare: () => void keepRacingTraining(),
      title: 'The best become parents',
      body: 'When every car is done, the best ones breed the next generation. Their children are copies or mixes of them, with small changes.',
      terms: [
        { term: 'Mutation', meaning: 'Small random changes. Weights shift, and sometimes a new link or neuron appears.' },
        { term: 'Crossover', meaning: 'A child that mixes the links of two parents.' },
      ],
    },
    {
      id: 'progress',
      chapter: LEARN,
      target: '[data-tour="fitness"]',
      fallback: '[data-tour="panel"]',
      prefer: ['left'],
      prepare: () => lab().set({ panelTab: 'progress' }),
      title: 'Watch it improve',
      body: 'One point per generation. The top line is the best car, the lower lines the typical car. Both should climb.',
    },
    {
      id: 'species',
      chapter: LEARN,
      target: '[data-tour="species"]',
      fallback: '[data-tour="panel"]',
      prefer: ['left'],
      prepare: () => lab().set({ panelTab: 'progress' }),
      title: 'Species protect new ideas',
      body: 'Similar networks form a species, one band each. A new idea competes only inside its species at first, so it has time to pay off.',
    },
    {
      id: 'speed',
      chapter: LEARN,
      target: '[data-tour="speed"]',
      prefer: ['top'],
      prepare: () => void keepRacingTraining(),
      title: 'Train faster',
      body: '1x to 4x let you watch. Turbo and Max train flat out on every core.',
      action: {
        // No shortcut shown: its key is 4, which reads as the 4x button right beside Turbo.
        prompt: 'Pick Turbo',
        done: racingFlatOut,
        doneLabel: 'Training flat out',
        then: {
          title: 'Learning in the background',
          body: 'Generations now finish in seconds. Turbo replays the latest champion on the track. Next, back to 1x to watch one car.',
        },
      },
    },
    {
      id: 'inputs',
      chapter: DRIVE,
      target: '[data-tour="inputs"]',
      prefer: ['bottom', 'left'],
      prepare: () => void watchRacingLive(),
      title: 'A network only sees numbers',
      body: 'A network starts from its inputs. Press Inputs to draw what the followed car senses.',
      action: {
        prompt: 'Press Inputs',
        shortcut: 'I',
        done: () => lab().inputsOverlay,
        doneLabel: 'Inputs on',
        then: {
          target: '[data-tour="viewport"]',
          title: 'What the car senses',
          body: 'Each ray measures the distance to the road edge. With speed and angle to the road, that is all the network knows.',
        },
      },
    },
    {
      id: 'network',
      chapter: DRIVE,
      target: '[data-tour="tab-network"]',
      prefer: ['left', 'bottom'],
      prepare: () => void watchRacingLive(),
      title: 'Look inside the champion',
      body: 'The Network tab shows the champion: the best driver of the last generation.',
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
      body: 'Overlay and Both replay earlier champions as ghost cars. The gap between them is what training bought.',
    },
    {
      id: 'sandbox',
      chapter: DRIVE,
      target: '[data-tour="sandbox"]',
      prefer: ['top'],
      title: 'Run them anywhere',
      body: 'The Sandbox races your champions on any track, even one you draw. Nothing learns there.',
    },
    {
      id: 'studio',
      chapter: YOURS,
      target: '[data-tour="nav-studio"]',
      prefer: ['bottom'],
      title: 'Write the rules yourself',
      body: 'In the Studio you write the training script: what earns fitness and when a run ends. The lessons show you how. Replay this tour from the ? button.',
      links: [{ label: 'Start the first lesson', href: '/studio?lesson=racing-01-drive-straight' }],
    },
  ],
};
