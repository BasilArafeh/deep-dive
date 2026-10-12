"""Full research agent pipeline as a compiled LangGraph StateGraph.

This file wires the five agent nodes together. The edge order below is the
execution order: planner → searcher → scraper → summarizer → synthesizer.
"""

from langgraph.graph import END, StateGraph

from app.agent.nodes.planner import planner_node
from app.agent.nodes.scraper import scraper_node
from app.agent.nodes.searcher import searcher_node
from app.agent.nodes.summarizer import summarizer_node
from app.agent.nodes.synthesizer import synthesizer_node
from app.agent.state import AgentState

# Create the graph with AgentState as the shared schema between nodes.
graph = StateGraph(AgentState)

# Register each node under a stable name used by edges below.
graph.add_node("planner", planner_node)
graph.add_node("searcher", searcher_node)
graph.add_node("scraper", scraper_node)
graph.add_node("summarizer", summarizer_node)
graph.add_node("synthesizer", synthesizer_node)

# Research always starts by decomposing the topic into sub-questions.
graph.set_entry_point("planner")

# Linear pipeline: each step feeds its outputs into the next via AgentState.
graph.add_edge("planner", "searcher")
graph.add_edge("searcher", "scraper")
graph.add_edge("scraper", "summarizer")
graph.add_edge("summarizer", "synthesizer")
graph.add_edge("synthesizer", END)

# Compile once so routers can import and invoke the runnable graph.
research_graph = graph.compile()
