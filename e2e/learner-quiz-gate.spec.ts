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

  const line = buildStartSpeechLine({
    languageCode: 'en',
    firstName: 'Simon',
    messages: [],
  })
  expect(line.spoken).toBe('Welcome back Simon, what shall we talk about today?')
  expect(line.english).toBeUndefined()

  const spanish = buildStartSpeechLine({
    languageCode: 'es',
    firstName: 'Simon',
    messages: [],
  })
  expect(spanish.spoken).toBe('Bienvenido de nuevo Simon, ¿de qué hablamos hoy?')
  expect(spanish.english).toBe('Welcome back Simon, what shall we talk about today?')
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

test('a returning login shows the welcome line, not the product tour', () => {
  expect(
    shouldShowSpokenTour({
      isAdmin: true,
      profileKnown: true,
      hasName: false,
      hasTalked: true,
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
  ).toBe(true)

  expect(
    shouldShowSpokenTour({
      isAdmin: false,
      profileKnown: true,
      hasName: false,
      hasTalked: false,
      completed: false,
      busy: false,
    }),
  ).toBe(true)

  const line = buildStartSpeechLine({
    languageCode: 'en',
    firstName: '',
    messages: [],
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
