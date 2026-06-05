# adapters/slack

Slack transport and event handling.

Receives Slack events (slash commands, mentions, button clicks), validates signatures, and dispatches to core logic. Sends formatted responses back via the Slack API. Bridges Slack's wire format to internal domain types.
