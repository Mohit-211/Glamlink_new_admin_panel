import axios from "axios";
import { BASE_URL } from "../Host";
import type { ApiResponse, Paged } from "../../types/api";
import type { TopicAiRun, TopicAiRunRequest, TopicItemType, TopicItems } from "../../types/topic";

// A topic's items and its AI runs (Nov 24; the backend's handoff, section 8.17). Every change to the items answers the
// whole list again. Refusals: 400 INVALID_TOPIC_ITEM or INVALID_AI_RUN with `details.field`, 404 NOT_FOUND.

type Id = number | string;

const topic = (topicId: Id) => `${BASE_URL}journal/topic/${topicId}`;

/** What is on the topic, by kind, and the AI's suggestions. */
export const GetTopicItems = async (topicId: Id) => {
  return axios.get<ApiResponse<TopicItems>>(`${topic(topicId)}/items`);
};

/**
 * Puts items on the topic, after the ones of their kind (one already there stays where it is), at most 100 at once.
 * Drafts may go on: the website shows them once published. A suggestion taken this way counts as the AI's pick.
 */
export const AddTopicItems = async (topicId: Id, items: { type: TopicItemType; id: number }[]) => {
  return axios.post<ApiResponse<TopicItems>>(`${topic(topicId)}/items`, { items });
};

/** Takes an item off the topic, or dismisses a suggestion. Either way the AI won't offer it again. */
export const RemoveTopicItem = async (topicId: Id, type: TopicItemType, itemId: Id) => {
  return axios.delete<ApiResponse<TopicItems>>(`${topic(topicId)}/items/${type}/${itemId}`);
};

/** The order of the topic's professionals, brands or products (articles and videos show newest first). */
export const OrderTopicItems = async (topicId: Id, type: TopicItemType, ids: number[]) => {
  return axios.put<ApiResponse<TopicItems>>(`${topic(topicId)}/items/${type}/order`, { ids });
};

/**
 * Starts an AI run: 202 with the run, `status: "running"`; read it with GetTopicAiRun until it's done. 409
 * AI_RUN_IN_PROGRESS (`details.run_id`) while the topic has one working; 503 AI_NOT_CONFIGURED without the server's
 * OpenAI key.
 */
export const StartTopicAiRun = async (topicId: Id, request: TopicAiRunRequest) => {
  return axios.post<ApiResponse<TopicAiRun>>(`${topic(topicId)}/ai-runs`, request);
};

/** One run, with its picks. */
export const GetTopicAiRun = async (topicId: Id, runId: Id) => {
  return axios.get<ApiResponse<TopicAiRun>>(`${topic(topicId)}/ai-runs/${runId}`);
};

/** The topic's runs, newest first, without their picks. */
export const GetTopicAiRuns = async (topicId: Id, params: { page?: number; limit?: number } = {}) => {
  return axios.get<ApiResponse<Paged<TopicAiRun>>>(`${topic(topicId)}/ai-runs`, { params });
};
