import {
  GameQuestion,
  GameSettings,
  GameState,
  GameStatePayload,
} from "../Game.types";
import { FinishableState } from "./FinishableState";
import {
  concatAllQuestionInRound,
  findRound,
  updateScore,
} from "./state.utils";
import { ACTIONS_STATES } from "./states.const";
import { WaitingForCardSelection } from "./WaitingForCardSelection";
import { WaitingForQuestionCapture } from "./WaitingForQuestionCapture";

export class WaitingForAnswer extends FinishableState {
  constructor(statePayload: GameStatePayload, gameSettings: GameSettings) {
    super(
      {
        ...statePayload,
        stateName: ACTIONS_STATES.WAITING_FOR_USER_ANSWER,
      },
      gameSettings
    );
  }

  answer(payload: {
    userId: number;
    answer: string;
    timestamp?: Date;
  }): GameState {
    const { answer: answerText, userId } = payload;
    const { answeringUserId } = this.gameState;
    if (userId !== answeringUserId) {
      throw new Error(`Only user with id = ${userId} can answer`);
    }
    const question = this.getCurrentQuestion();
    const rightAnswer = question.answer;
    if (answerText !== rightAnswer) {
      return this.wrongAnswer({ price: question.price });
    } else {
      return this.rightAnswer({ price: question.price });
    }
  }

  protected wrongAnswer(payload: { price: number }): GameState {
    const { answeringUserId, answeredPlayerIds } = this.gameState;
    const playerScore = updateScore(this.gameState.playerScore, {
      userId: answeringUserId,
      score: -payload.price,
    });
    const newAnsweredPlayerIds = [...answeredPlayerIds, answeringUserId];
    const nextPayloadState = {
      ...this.gameState,
      playerScore,
      cardSelectionAt: new Date(),
      answeringUserId: null,
      answeredPlayerIds: newAnsweredPlayerIds,
    };
    const allPlayerHasAnswered =
      newAnsweredPlayerIds.length === this.gameSettings.playerIds.length;

    if (allPlayerHasAnswered) {
      if (this.roundWillFinish()) {
        return this.nextRound(nextPayloadState);
      } else {
        const waitingPayloadState = {
          ...nextPayloadState,
          answeringUserId: null,
          answeredPlayerIds: [],
          selectedQuestionId: null,
        };

        return new WaitingForCardSelection(
          waitingPayloadState,
          this.gameSettings
        );
      }
    } else {
      return new WaitingForQuestionCapture(nextPayloadState, this.gameSettings);
    }
  }

  private rightAnswer(payload: { price: number }): GameState {
    const {
      answeringUserId,
      openedQuestionsIds,
      selectedQuestionId,
    } = this.gameState;
    const newPlayerScores = updateScore(this.gameState.playerScore, {
      userId: answeringUserId,
      score: payload.price,
    });
    const newOpenedQuestionIds = [...openedQuestionsIds, selectedQuestionId];
    const nextPayloadSate = {
      ...this.gameState,
      openedQuestionsIds: newOpenedQuestionIds,
      playerScore: newPlayerScores,
      currentPlayerId: answeringUserId,
      answeringUserId: null,
      answeredPlayerIds: [],
      selectedQuestionId: null,
    };
    if (this.roundWillFinish()) {
      return this.nextRound(nextPayloadSate);
    } else {
      return new WaitingForCardSelection(nextPayloadSate, this.gameSettings);
    }
  }

  private getCurrentQuestion(): GameQuestion {
    const { currentRoundId, selectedQuestionId } = this.gameState;
    const currentRound = findRound(this.gameSettings, currentRoundId);
    if (!currentRound) {
      throw new Error(`Round with id = ${currentRoundId} not found`);
    }
    const questions = concatAllQuestionInRound(currentRound);
    const question = questions.find(
      (question) => question.id === selectedQuestionId
    );
    if (!question) {
      throw new Error(`Question with id = ${selectedQuestionId} not found`);
    }
    return question;
  }
}
