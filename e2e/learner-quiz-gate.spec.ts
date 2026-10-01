import { expect, test } from '@playwright/test'
import { buildStartSpeechLine } from '../src/architecture/keaStartSpeech'
import {
  shouldShowLearnerQuiz,
  shouldShowSpokenTour,
} from '../src/architecture/learnerQuizGate'

test('returning members skip the questionnaire and hear one welcome', () => {
  expect(
    shouldShowLearnerQuiz({
      isAdmin: false,
      review: false,
      profileKnown: true,
      hasAnswers: false,
      hasTalked: true,
    }),
  ).toBe(false)

  const prior = [
    { id: 'u1', speaker: 'user' as const, text: 'hola' },
  ]
  const line = buildStartSpeechLine({
    languageCode: 'en',
    firstName: 'Simon',
    messages: prior,
  })
  expect(line.spoken).toBe('Welcome back Simon, what shall we talk about today?')
  expect(line.english).toBeUndefined()
  expect(line.kind).toBe('welcome-back')

  const spanish = buildStartSpeechLine({
    languageCode: 'es',
    firstName: 'Simon',
    messages: prior,
  })
  expect(spanish.spoken).toBe('Bienvenido de nuevo Simon, ¿de qué hablamos hoy?')
  expect(spanish.english).toBe('Welcome back Simon, what shall we talk about today?')
})

test('first meet greeting is long and bilingual once', () => {
  const line = buildStartSpeechLine({
    languageCode: 'es',
    firstName: 'Simon',
    messages: [],
    userKey: 'test-first-meet',
  })
  expect(line.kind).toBe('welcome')
  expect(line.spoken).toContain('Simon')
  expect(line.spoken).toMatch(/encantada|conocerte|hablamos/i)
  expect(line.english).toContain('nice to meet you')
  expect(line.english).toContain('favourite food')
})

test('a new member sees the questionnaire once', () => {
  expect(
    shouldShowLearnerQuiz({
      isAdmin: false,
      review: false,
      profileKnown: true,
      hasAnswers: false,
      hasTalked: false,
    }),
  ).toBe(true)

  expect(
    shouldShowLearnerQuiz({
      isAdmin: false,
      review: false,
      profileKnown: true,
      hasAnswers: true,
      hasTalked: false,
    }),
  ).toBe(false)
})

test('How to use Kea only after stage 1, never on a normal login', () => {
  expect(
    shouldShowSpokenTour({
      isAdmin: false,
      profileKnown: true,
      hasName: true,
      hasTalked: true,
      completed: false,
      busy: false,
    }),
  ).toBe(false)

  expect(
    shouldShowSpokenTour({
      isAdmin: false,
      profileKnown: true,
      hasName: false,
      hasTalked: false,
      completed: false,
      busy: false,
    }),
  ).toBe(false)

  expect(
    shouldShowSpokenTour({
      isAdmin: true,
      profileKnown: true,
      hasName: true,
      hasTalked: false,
      completed: false,
      busy: false,
    }),
  ).toBe(false)

  expect(
    shouldShowSpokenTour({
      isAdmin: false,
      profileKnown: true,
      hasName: true,
      hasTalked: false,
      completed: false,
      awaitingTour: true,
      busy: false,
    }),
  ).toBe(false)

  expect(
    shouldShowSpokenTour({
      isAdmin: false,
      profileKnown: true,
      hasName: true,
      hasTalked: false,
      completed: false,
      awaitingTour: true,
      tourArmed: true,
      busy: false,
    }),
  ).toBe(true)

  expect(
    shouldShowSpokenTour({
      isAdmin: true,
      profileKnown: true,
      hasName: true,
      hasTalked: true,
      completed: true,
      awaitingTour: true,
      tourArmed: true,
      busy: false,
    }),
  ).toBe(true)

  const line = buildStartSpeechLine({
    languageCode: 'en',
    firstName: '',
    messages: [{ id: 'u1', speaker: 'user', text: 'hi' }],
  })
  expect(line.spoken).toBe('Welcome back, what shall we talk about today?')
  expect(line.english).toBeUndefined()
})

test('admin does not see onboarding unless they open it', () => {
  expect(
    shouldShowLearnerQuiz({
      isAdmin: true,
      review: false,
      profileKnown: true,
      hasAnswers: false,
      hasTalked: false,
    }),
  ).toBe(false)

  expect(
    shouldShowLearnerQuiz({
      isAdmin: true,
      review: true,
      profileKnown: true,
      hasAnswers: true,
      hasTalked: true,
    }),
  ).toBe(true)
})
