import { Dna, Eye, Users } from 'lucide-react';
import { useHideSeekLab } from '@/features/hideseek/state/hideSeekStore';
import type { Tour } from '@/ui/walkthrough/types';

const LEARN = 'How they learn';
const PLAY = 'How they play';
const lab = () => useHideSeekLab.getState();

/** The Hide and Seek lab tour: two teams that learn against each other, then what a trained agent senses and does. */
export const HIDE_SEEK_TOUR: Tour = {
  id: 'hideseek',
  storageKey: 'sandboxlab.tour.hideseek',
  intro: {
    title: 'Welcome to Hide and Seek',
    body: 'Two teams learn against each other. Every trick one side finds pushes the other to find an answer.',
    icon: <Users />,
    chapters: [
      { label: LEARN, icon: <Dna /> },
      { label: PLAY, icon: <Eye /> },
    ],
  },
  steps: [
    {
      id: 'train',
      chapter: LEARN,
      target: '[data-tour="train"]',
      prefer: ['top', 'right'],
      title: 'Hiders against seekers',
      body: 'Each team has its own small neural networks. Hiders score while no seeker can see them, and seekers score while they can.',
      action: {
        prompt: 'Press Train',
        shortcut: 'Space',
        done: () => lab().status === 'running',
        doneLabel: 'Training',
        then: {
          target: '[data-tour="viewport"]',
          title: '50 matches at once',
          body: 'Each tile is an arena with one hider and one seeker. The hider gets a head start while the seeker waits, frozen and blind.',
        },
      },
    },
    {
      id: 'race',
      chapter: LEARN,
      target: '[data-tour="panel"]',
      prefer: ['left'],
      prepare: () => lab().set({ panelTab: 'progress' }),
      title: 'An arms race',
      body: 'The best of each team breed the next generation. When one team pulls ahead, the other usually answers a few generations later.',
    },
    {
      id: 'arenas',
      chapter: PLAY,
      target: '[data-tour="arenas"]',
      fallback: '[data-tour="viewport"]',
      prefer: ['bottom', 'left'],
      title: 'Fly in close',
      body: 'The grid shows every match at once. Pick 1, or click any arena, to watch a single match up close.',
      action: {
        prompt: 'Pick 1 or click an arena',
        done: () => lab().gridSize === 1 || lab().focus !== null,
        doneLabel: 'Up close',
        then: {
          target: '[data-tour="viewport"]',
          title: 'Crates, ramps and locks',
          body: 'Agents can grab and push crates and ramps. A seeker can push a ramp to a wall, run up it and jump over.',
          terms: [{ term: 'Lock', meaning: 'A locked crate or ramp stays put. Only the team that locked it can free it, and the padlock color shows whose it is.' }],
        },
      },
    },
    {
      id: 'senses',
      chapter: PLAY,
      target: '[data-tour="inputs"]',
      prefer: ['bottom', 'left'],
      title: 'What they sense',
      body: 'Each agent reads rays that tell walls, crates and players apart, and whether the other player is in sight.',
      action: {
        prompt: 'Press Inputs',
        shortcut: 'I',
        done: () => lab().inputsOverlay,
        doneLabel: 'Inputs on',
        then: {
          target: '[data-tour="viewport"]',
          title: 'Senses in, moves out',
          body: "Every tick those numbers run through the agent's network. Out come its moves: walk, turn, grab and lock.",
        },
      },
    },
    {
      id: 'sandbox',
      chapter: PLAY,
      target: '[data-tour="sandbox"]',
      prefer: ['top'],
      title: 'Set up your own match',
      body: 'The Sandbox plays trained hiders and seekers in any room, even one you build. Nothing learns there.',
    },
    {
      id: 'studio',
      target: '[data-tour="nav-studio"]',
      prefer: ['bottom'],
      title: 'Write the rules yourself',
      body: 'In the Studio you decide what each team scores for. The lessons walk you through it one step at a time.',
      links: [{ label: 'Start the first lesson', href: '/studio?lesson=hideseek-01-points-for-hiding' }],
    },
  ],
};
