import { Car, Cpu, Dna } from 'lucide-react';
import { useRacingLab } from '@/features/racing/state/labStore';
import type { Tour } from '@/ui/walkthrough/types';

const LEARN = 'How it learns';
const DRIVE = 'How it drives';
const lab = () => useRacingLab.getState();

/**
 * The Racing lab tour. The first half explains training, the second how a
 * trained network runs. A few steps wait for the user to press the real
 * control, then explain what it set going.
 */
export const RACING_TOUR: Tour = {
  id: 'racing',
  storageKey: 'sandboxlab.tour.racing',
  intro: {
    title: 'Welcome to the Racing lab',
    body: 'These cars teach themselves to drive. See how they learn, then how a trained one drives.',
    icon: <Car />,
    chapters: [
      { label: LEARN, icon: <Dna /> },
      { label: DRIVE, icon: <Cpu /> },
    ],
  },
  steps: [
    {
      id: 'train',
      chapter: LEARN,
      target: '[data-tour="train"]',
      prefer: ['top', 'right'],
      title: 'Every car has a brain',
      body: 'Each car is driven by a small neural network. At first its links are random, so it drives badly.',
      action: {
        prompt: 'Press Train',
        shortcut: 'Space',
        done: () => lab().status === 'running',
        doneLabel: 'Training',
        then: {
          target: '[data-tour="viewport"]',
          title: 'Fitness is the score',
          body: 'Every car now drives on its own network. It scores fitness for how far it gets, plus a little for speed. A crash ends its run.',
        },
      },
    },
    {
      id: 'parents',
      chapter: LEARN,
      target: '[data-tour="generation"]',
      fallback: '[data-tour="viewport"]',
      prefer: ['top'],
      title: 'The best become parents',
      body: 'When every car is done, the best ones breed the next generation. Their children start as copies, with small changes.',
      terms: [
        { term: 'Mutation', meaning: 'Small random changes to the links of a network.' },
        { term: 'Crossover', meaning: 'A child that mixes the links of two parents.' },
      ],
    },
    {
      id: 'progress',
      chapter: LEARN,
      target: '[data-tour="fitness"], [data-tour="species"]',
      fallback: '[data-tour="panel"]',
      prefer: ['left'],
      prepare: () => lab().set({ panelTab: 'progress' }),
      title: 'Watch it improve',
      body: 'Each generation adds a point. The top line is the best car, the lines below it the typical car. Both should climb.',
      terms: [{ term: 'Species', meaning: 'Groups of similar networks. A new idea first competes inside its own group, so it has time to pay off.' }],
    },
    {
      id: 'speed',
      chapter: LEARN,
      target: '[data-tour="speed"]',
      prefer: ['top'],
      title: 'Train faster',
      body: '1x to 4x let you watch every car. Turbo and Max train flat out on every core of your computer.',
      action: {
        prompt: 'Pick Turbo',
        shortcut: '4',
        done: () => lab().speed === 'turbo' || lab().speed === 'max',
        doneLabel: 'Training flat out',
        then: {
          title: 'Learning in the background',
          body: 'Generations now finish in seconds, out of sight. With Turbo the track replays the latest champion, so you still see the best driver.',
        },
      },
    },
    {
      id: 'inputs',
      chapter: DRIVE,
      target: '[data-tour="inputs"]',
      prefer: ['bottom', 'left'],
      title: 'A network only sees numbers',
      body: 'Running a trained network starts with its inputs. Press Inputs to draw what the followed car senses.',
      action: {
        prompt: 'Press Inputs',
        shortcut: 'I',
        done: () => lab().inputsOverlay,
        doneLabel: 'Inputs on',
        then: {
          target: '[data-tour="viewport"]',
          title: 'Rays and speed',
          body: 'Each ray measures how far the road edge is in one direction. Those distances and the speed are all the network knows.',
        },
      },
    },
    {
      id: 'network',
      chapter: DRIVE,
      target: '[data-tour="tab-network"]',
      prefer: ['left', 'bottom'],
      title: 'Look inside the champion',
      body: 'The Network tab shows the champion network, the best driver of the latest finished generation.',
      action: {
        prompt: 'Open the Network tab',
        done: () => lab().panelTab === 'network',
        doneLabel: 'Network open',
        then: {
          target: '[data-tour="panel"]',
          title: 'This is the model running',
          body: 'Every tick the inputs on the left flow through the links to steering and pedal on the right. Links light up as they carry the decision.',
          terms: [{ term: 'Weight', meaning: 'How strongly a link passes its signal on. Blue links pass it as it is, orange links flip it.' }],
        },
      },
    },
    {
      id: 'ghosts',
      chapter: DRIVE,
      target: '[data-tour="view"]',
      prefer: ['bottom', 'left'],
      title: 'Ghosts of past champions',
      body: 'Overlay replays champions of earlier generations as ghost cars beside the live ones. The gap between them is what training bought.',
    },
    {
      id: 'sandbox',
      chapter: DRIVE,
      target: '[data-tour="sandbox"]',
      prefer: ['top'],
      title: 'Run them anywhere',
      body: 'The Sandbox races trained champions on any track, even one you draw. Nothing learns there. The networks only drive.',
    },
    {
      id: 'studio',
      target: '[data-tour="nav-studio"]',
      prefer: ['bottom'],
      title: 'Write the rules yourself',
      body: 'In the Studio you write the training script: what earns fitness and when a run ends. The lessons take you through it one step at a time.',
      links: [{ label: 'Start the first lesson', href: '/studio?lesson=racing-01-drive-straight' }],
    },
  ],
};
