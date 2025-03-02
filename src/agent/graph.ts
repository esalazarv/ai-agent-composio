/**
 * Starter LangGraph.js Template
 * Make this code your own!
 */
import { LangGraphToolSet } from "composio-core";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import { StateGraph, END, MessagesAnnotation, START } from "@langchain/langgraph";
import { HumanMessage } from "@langchain/core/messages";
import { RunnableConfig } from "@langchain/core/runnables";
import { StateAnnotation } from "./state.js";


const composioToolset = new LangGraphToolSet();
const auth = false;
if (auth) {
const connection = await composioToolset.connectedAccounts.initiate({appName: "github"})
console.log(`Open this URL to authenticate: ${connection.redirectUrl}`);
}
const tools = await composioToolset.getTools({
    apps: ["github"],
    useCase: "authenticated repositories"
}, 'esalazarv');

console.log(tools);
const toolNode = new ToolNode(tools);

const model = new ChatOpenAI({ temperature: 0, apiKey: process.env.OPENAI_API_KEY}).bindTools(tools);

/**
 * Define a node, these do the work of the graph and should have most of the logic.
 * Must return a subset of the properties set in StateAnnotation.
 * @param state The current state of the graph.
 * @param config Extra parameters passed into the state graph.
 * @returns Some subset of parameters of the graph state, used to update the state
 * for the edges and nodes executed next.
 */
const callModel = async (
  state: typeof StateAnnotation.State,
  _config: RunnableConfig,
): Promise<typeof StateAnnotation.Update> => {
  const { messages } = state;
  const response = await model.invoke(messages);
  return { messages: [response] };
};

/**
 * Routing function: Determines whether to continue research or end the builder.
 * @param state - The current state of the research builder
 * @returns Either "tools" to execute tool calls, or END to finish
 */
export const route = (
  state: typeof StateAnnotation.State,
): "__end__" | "tools" => {
  const { messages } = state;
  const lastMessage = messages[messages.length - 1];

  // Check if the message has tool calls using the proper method
  if (lastMessage.tool_calls?.length > 0) {
    return "tools";
  }
  return END;
};

// Finally, create the graph itself.
const builder = new StateGraph(StateAnnotation)
  .addNode("agent", callModel)
  .addEdge(START, "agent")
  .addNode("tools", toolNode)
  .addConditionalEdges("agent", route)
  .addEdge("tools", "agent");

export const graph = builder.compile();

graph.name = "New Agent";
