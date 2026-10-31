import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getSoundById } from '../../data/sounds';
import { getSentences } from '../../data/sentences';
import BackButton from '../../components/BackButton/BackButton';
import ProgressBar from '../../components/ProgressBar/ProgressBar';
import GameResult from '../../components/GameResult/GameResult';
import { speakText, isSpeechSynthesisSupported } from '../../utils/speechSynthesis';
import { startSpeechRecognition, isSpeechRecognitionSupported } from '../../utils/speechRecognition';
import './SentencesPage.css';

const STEP = {
  SELECT_WORD: 'select_word',
  LISTEN: 'listen',
  SPEAK: 'speak'
};

const PRAISE_PHRASES = [
  'Молодец!',
  'Отлично!',
  'Супер!',
  'Прекрасно!',
  'Замечательно!'
];

const SentencesPage = () => {
  const navigate = useNavigate();
  const { soundId } = useParams();
  const sound = getSoundById(soundId);
  const sentences = getSentences(soundId);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentStep, setCurrentStep] = useState(STEP.SELECT_WORD);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [incorrectAttempts, setIncorrectAttempts] = useState(0);
  const [score, setScore] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);

  const [hasPlayedAudio, setHasPlayedAudio] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  const [isListening, setIsListening] = useState(false);
  const [recognitionError, setRecognitionError] = useState(null);
  const [pronunciationAttempts, setPronunciationAttempts] = useState(0);
  const [recognizedText, setRecognizedText] = useState('');
  const [pronunciationFeedback, setPronunciationFeedback] = useState(null);
  const [stopRecognition, setStopRecognition] = useState(null);

  const speechRecognitionAvailable = isSpeechRecognitionSupported();
  const speechSynthesisAvailable = isSpeechSynthesisSupported();

  useEffect(() => {
    return () => {
      if (stopRecognition) {
        stopRecognition();
      }
    };
  }, [stopRecognition]);

  if (!sound || sentences.length === 0) {
    navigate('/');
    return null;
  }

  const currentSentence = sentences[currentIndex];
  const isLastSentence = currentIndex === sentences.length - 1;
  const hasAnsweredCorrectly = selectedAnswer === currentSentence.correctAnswer;

  const handleAnswerSelect = (answer) => {
    if (hasAnsweredCorrectly) return;

    setSelectedAnswer(answer);
    const correct = answer === currentSentence.correctAnswer;

    if (correct) {
      setScore(score + 1);

      // Brief praise audio for correct word selection
      if (speechSynthesisAvailable) {
        setTimeout(() => {
          speakText('Молодец!');
        }, 300);
      }
    } else {
      setIncorrectAttempts(incorrectAttempts + 1);
      setTimeout(() => {
        setSelectedAnswer(null);
      }, 1500);
    }
  };

  const playPictureAudio = () => {
    if (!speechSynthesisAvailable || isPlayingAudio) return;

    setIsPlayingAudio(true);
    const text = hasAnsweredCorrectly
      ? currentSentence.sentence.replace('_____', currentSentence.correctAnswer)
      : currentSentence.sentence.replace('_____', '...');

    const success = speakText(text);
    if (success) {
      setTimeout(() => setIsPlayingAudio(false), 3000);
    } else {
      setIsPlayingAudio(false);
    }
  };

  const playWordAudio = () => {
    if (!speechSynthesisAvailable || isPlayingAudio) return;

    setIsPlayingAudio(true);
    const success = speakText(currentSentence.targetWord);
    if (success) {
      setTimeout(() => setIsPlayingAudio(false), 2000);
    } else {
      setIsPlayingAudio(false);
    }
  };

  const handleContinueToListen = () => {
    if (speechSynthesisAvailable) {
      setCurrentStep(STEP.LISTEN);
    } else {
      handleSkipToNext();
    }
  };

  const playFullAudio = () => {
    if (!speechSynthesisAvailable) return;

    setIsPlayingAudio(true);
    const success = speakText(currentSentence.audioPrompt || currentSentence.sentence);

    if (success) {
      setHasPlayedAudio(true);
      setTimeout(() => setIsPlayingAudio(false), 4000);
    } else {
      setIsPlayingAudio(false);
    }
  };

  const handleContinueToSpeak = () => {
    if (speechRecognitionAvailable) {
      setCurrentStep(STEP.SPEAK);
    } else {
      handleSkipToNext();
    }
  };

  const normalizeText = (text) => {
    return (text || '')
      .toLowerCase()
      .replace(/ё/g, 'е')
      .replace(/[^а-яa-z\s]/gi, '')
      .trim();
  };

  const handleStartRecording = () => {
    if (!speechRecognitionAvailable || isListening) return;

    setRecognitionError(null);
    setPronunciationFeedback(null);
    setRecognizedText('');

    const stop = startSpeechRecognition(
      currentSentence.targetWord,
      {
        onListeningChange: (listening) => {
          setIsListening(listening);
        },
        onError: (error) => {
          setIsListening(false);
          setRecognitionError(error);
        },
        onTranscript: (transcript) => {
          setRecognizedText(transcript);
        },
        onResult: ({ transcript, matched }) => {
          setIsListening(false);
          setRecognizedText(transcript);

          const normalizedTranscript = normalizeText(transcript);
          const normalizedTarget = normalizeText(currentSentence.targetWord);
          const isMatch = normalizedTranscript === normalizedTarget ||
                         normalizedTranscript.includes(normalizedTarget);

          if (isMatch) {
            const praise = PRAISE_PHRASES[Math.floor(Math.random() * PRAISE_PHRASES.length)];
            setPronunciationFeedback({
              success: true,
              message: `${praise} Ты сказал: ${currentSentence.targetWord}!`
            });
            setPronunciationAttempts(0);

            // Play praise for pronunciation success
            if (speechSynthesisAvailable) {
              setTimeout(() => {
                speakText(praise);
              }, 300);
            }
          } else {
            const newAttemptCount = pronunciationAttempts + 1;
            setPronunciationAttempts(newAttemptCount);

            if (newAttemptCount >= 3) {
              setPronunciationFeedback({
                success: false,
                message: 'Выбери, как продолжить.',
                showOptions: true
              });
            } else {
              setPronunciationFeedback({
                success: false,
                message: 'Давай попробуем ещё раз! Послушай слово внимательно.',
                canRetry: true
              });
            }
          }
        }
      },
      { matchMode: 'exact-word' }
    );

    setStopRecognition(() => stop);
  };

  const handleRetryPronunciation = () => {
    setPronunciationFeedback(null);
    setRecognitionError(null);
    setRecognizedText('');
    playFullAudio();
  };

  const handleSelfAssessment = () => {
    setPronunciationFeedback({
      success: true,
      message: 'Хорошо! Продолжаем дальше.',
      selfAssessed: true
    });
    setPronunciationAttempts(0);
  };

  const handleSkipToNext = () => {
    if (isLastSentence) {
      setIsCompleted(true);
    } else {
      setCurrentIndex(currentIndex + 1);
      resetItemState();
    }
  };

  const resetItemState = () => {
    setCurrentStep(STEP.SELECT_WORD);
    setSelectedAnswer(null);
    setIncorrectAttempts(0);
    setHasPlayedAudio(false);
    setIsPlayingAudio(false);
    setPronunciationAttempts(0);
    setPronunciationFeedback(null);
    setRecognitionError(null);
    setRecognizedText('');
    if (stopRecognition) {
      stopRecognition();
      setStopRecognition(null);
    }
  };

  const handleRepeat = () => {
    setCurrentIndex(0);
    setScore(0);
    setIsCompleted(false);
    resetItemState();
  };

  const handleBackToCategories = () => {
    navigate(`/sound/${soundId}/categories`);
  };

  const handleBack = () => {
    navigate(`/sound/${soundId}/categories`);
  };

  if (isCompleted) {
    return (
      <GameResult
        score={score}
        total={sentences.length}
        onRepeat={handleRepeat}
        onBackToCategories={handleBackToCategories}
      />
    );
  }

  const getHintMessage = () => {
    if (incorrectAttempts === 0) return null;
    if (incorrectAttempts === 1) return 'Подумай ещё немного!';
    if (incorrectAttempts === 2) return `Подсказка: правильное слово начинается на "${currentSentence.correctAnswer[0]}"`;
    return `Правильный ответ: ${currentSentence.correctAnswer}`;
  };

  return (
    <div className="sentences-page">
      <div className="sentences-page__header">
        <BackButton onClick={handleBack} />
        <ProgressBar current={currentIndex + 1} total={sentences.length} showText={true} />
      </div>

      <div className="sentences-page__content">
        {currentStep === STEP.SELECT_WORD && (
          <div className="sentences-page__container">
            <button
              className="sentences-page__emoji-hero"
              onClick={playPictureAudio}
              disabled={isPlayingAudio}
              aria-label="Прослушать предложение"
            >
              {currentSentence.emoji}
              {speechSynthesisAvailable && (
                <span className="sentences-page__emoji-speaker">
                  {isPlayingAudio ? '🔊' : '🔈'}
                </span>
              )}
            </button>

            <div className="sentences-page__sentence-display">
              {currentSentence.sentence}
            </div>

            {getHintMessage() && (
              <div className={`sentences-page__hint ${incorrectAttempts >= 3 ? 'show-answer' : ''}`}>
                {getHintMessage()}
              </div>
            )}

            <div className="sentences-page__word-choices">
              {currentSentence.options.map((option, index) => {
                let buttonClass = 'sentences-page__word-button';

                const isSelected = selectedAnswer === option;
                const isCorrectOption = option === currentSentence.correctAnswer;

                if (hasAnsweredCorrectly && isCorrectOption) {
                  buttonClass += ' correct';
                }

                if (isSelected && !isCorrectOption) {
                  buttonClass += ' shake-animation';
                }

                return (
                  <button
                    key={index}
                    className={buttonClass}
                    onClick={() => handleAnswerSelect(option)}
                    disabled={hasAnsweredCorrectly}
                  >
                    {option}
                  </button>
                );
              })}
            </div>

            {hasAnsweredCorrectly && (
              <div className="sentences-page__result-card success">
                <div className="sentences-page__result-icon">✓</div>
                <div className="sentences-page__result-content">
                  <div className="sentences-page__result-title">Молодец!</div>
                  <div className="sentences-page__result-text">
                    {currentSentence.sentence.replace('_____', currentSentence.correctAnswer)}
                  </div>
                </div>
              </div>
            )}

            {hasAnsweredCorrectly && (
              <button
                className="sentences-page__continue-btn"
                onClick={handleContinueToListen}
              >
                {speechSynthesisAvailable ? '🔊 Послушать и повторить' : '➡️ Далее'}
              </button>
            )}
          </div>
        )}

        {currentStep === STEP.LISTEN && (
          <div className="sentences-page__container">
            <div className="sentences-page__step-badge">Шаг 2 из 3</div>

            <button
              className="sentences-page__emoji-hero"
              onClick={playFullAudio}
              disabled={isPlayingAudio}
              aria-label="Прослушать предложение"
            >
              {currentSentence.emoji}
              {speechSynthesisAvailable && (
                <span className="sentences-page__emoji-speaker">
                  {isPlayingAudio ? '🔊' : '🔈'}
                </span>
              )}
            </button>

            <div className="sentences-page__completed-sentence">
              {currentSentence.sentence.replace('_____', currentSentence.correctAnswer)}
            </div>

            <div className="sentences-page__word-audio">
              <div className="sentences-page__word-audio-label">
                Целевое слово: <strong>{currentSentence.targetWord}</strong>
              </div>
              {speechSynthesisAvailable && (
                <button
                  className="sentences-page__word-speaker-btn"
                  onClick={playWordAudio}
                  disabled={isPlayingAudio}
                  aria-label={`Прослушать слово ${currentSentence.targetWord}`}
                >
                  {isPlayingAudio ? '🔊' : '🔈'} Слушать слово
                </button>
              )}
            </div>

            <button
              className={`sentences-page__audio-control ${isPlayingAudio ? 'playing' : ''}`}
              onClick={playFullAudio}
              disabled={isPlayingAudio}
            >
              <div className="sentences-page__audio-icon">
                {isPlayingAudio ? '🔊' : '🔈'}
              </div>
              <div className="sentences-page__audio-label">
                {isPlayingAudio ? 'Слушай внимательно...' : hasPlayedAudio ? 'Послушать ещё раз' : 'Нажми и послушай'}
              </div>
            </button>

            {!speechSynthesisAvailable && (
              <div className="sentences-page__info-message warning">
                Голосовое воспроизведение недоступно в вашем браузере.
              </div>
            )}

            {hasPlayedAudio && (
              <button
                className="sentences-page__continue-btn"
                onClick={handleContinueToSpeak}
              >
                {speechRecognitionAvailable ? '🎙️ Произнести' : (isLastSentence ? '✅ Завершить' : '➡️ Далее')}
              </button>
            )}
          </div>
        )}

        {currentStep === STEP.SPEAK && (
          <div className="sentences-page__container">
            <div className="sentences-page__step-badge">
              Шаг 3 из 3 {pronunciationAttempts > 0 && `• Попытка ${pronunciationAttempts} из 3`}
            </div>

            <button
              className="sentences-page__emoji-hero small"
              onClick={playWordAudio}
              disabled={isPlayingAudio}
              aria-label="Прослушать слово"
            >
              {currentSentence.emoji}
              {speechSynthesisAvailable && (
                <span className="sentences-page__emoji-speaker">
                  {isPlayingAudio ? '🔊' : '🔈'}
                </span>
              )}
            </button>

            <div className="sentences-page__target-display">
              Произнеси слово: <strong>{currentSentence.targetWord}</strong>
            </div>

            <button
              className={`sentences-page__mic-control ${isListening ? 'listening' : ''}`}
              onClick={handleStartRecording}
              disabled={isListening || pronunciationFeedback?.success}
            >
              <div className="sentences-page__mic-icon">
                {isListening ? '🎤' : '🎙️'}
              </div>
              <div className="sentences-page__mic-label">
                {isListening ? 'Слушаю тебя...' : 'Нажми и произнеси слово'}
              </div>
            </button>

            {recognizedText && (
              <div className="sentences-page__transcription">
                <div className="sentences-page__transcription-label">Приложение услышало:</div>
                <div className="sentences-page__transcription-text">
                  {recognizedText || '(не распознано)'}
                </div>
                <div className="sentences-page__transcription-note">
                  Распознавание речи определяет слово, но не оценивает произношение звуков.
                </div>
              </div>
            )}

            {recognitionError && (
              <div className="sentences-page__info-message error">
                {recognitionError}
              </div>
            )}

            {pronunciationFeedback && (
              <div className={`sentences-page__pronunciation-card ${pronunciationFeedback.success ? 'success' : 'retry'}`}>
                <div className="sentences-page__pronunciation-emoji">
                  {pronunciationFeedback.success ? '⭐' : '💪'}
                </div>
                <div className="sentences-page__pronunciation-text">
                  {pronunciationFeedback.message}
                </div>
              </div>
            )}

            {!speechRecognitionAvailable && (
              <div className="sentences-page__info-message warning">
                Распознавание речи недоступно. Попробуй открыть страницу через HTTPS или используй другой браузер.
              </div>
            )}

            {pronunciationFeedback && (
              <div className="sentences-page__action-group">
                {pronunciationFeedback.showOptions && (
                  <>
                    <button
                      className="sentences-page__retry-btn"
                      onClick={handleRetryPronunciation}
                    >
                      🔄 Послушать ещё раз
                    </button>
                    <button
                      className="sentences-page__retry-btn"
                      onClick={() => {
                        setPronunciationFeedback(null);
                        setRecognizedText('');
                        setPronunciationAttempts(pronunciationAttempts - 1);
                      }}
                    >
                      🎙️ Попробовать ещё
                    </button>
                    <button
                      className="sentences-page__self-assess-btn"
                      onClick={handleSelfAssessment}
                    >
                      ✓ Я сказал правильно
                    </button>
                  </>
                )}
                {pronunciationFeedback.canRetry && (
                  <button
                    className="sentences-page__retry-btn"
                    onClick={handleRetryPronunciation}
                  >
                    🔄 Послушать и попробовать снова
                  </button>
                )}
                {(pronunciationFeedback.success || pronunciationFeedback.selfAssessed) && (
                  <button
                    className="sentences-page__continue-btn"
                    onClick={handleSkipToNext}
                  >
                    {isLastSentence ? '✅ Завершить' : '➡️ Следующее предложение'}
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SentencesPage;
