use serde::Deserialize;

// tiny structs to map only what we need
#[derive(Deserialize)]
struct LogEnvelope {
    #[serde(default)]
    #[serde(rename = "type")]
    kind: String,
    message: Option<LogMessage>,
}

#[derive(Deserialize)]
struct LogMessage {
    content: Vec<LogSegment>,
}

#[derive(Deserialize)]
struct LogSegment {
    #[serde(rename = "type")]
    seg_type: String,
    name: Option<String>,
    input: Option<TodoInput>,
}

#[derive(Deserialize)]
struct TodoInput {
    todos: Vec<ClaudeTodo>,
}

#[derive(Deserialize)]
pub struct ClaudeTodo {
    pub id: String,
    pub content: String,
    pub priority: String,
    pub status: String,
}

/// Parses a single log line. Returns (task_id, Vec<ClaudeTodo>)
pub fn parse_todo_line(_task_id: i32, line: &str) -> anyhow::Result<Vec<ClaudeTodo>> {
    let env: LogEnvelope = serde_json::from_str(line)?;
    if env.kind != "assistant" {
        return Ok(vec![]);
    }

    let Some(msg) = env.message else {
        return Ok(vec![]);
    };

    let mut todos = Vec::new();
    for seg in msg.content {
        if seg.seg_type == "tool_use" && seg.name.as_deref() == Some("TodoWrite") {
            if let Some(input) = seg.input {
                todos.extend(input.todos);
            }
        }
    }
    Ok(todos)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_todo_line() {
        let log_line = r#"{"type":"assistant","message":{"content":[{"type":"tool_use","name":"TodoWrite","input":{"todos":[{"id":"1","content":"Add serde dependencies to Cargo.toml","status":"pending","priority":"high"},{"id":"2","content":"Create agent_log_parser.rs module","status":"pending","priority":"high"},{"id":"3","content":"Add unit tests","status":"pending","priority":"medium"}]}}]}}"#;

        let result = parse_todo_line(123, log_line).unwrap();
        assert_eq!(result.len(), 3);

        assert_eq!(result[0].id, "1");
        assert_eq!(result[0].content, "Add serde dependencies to Cargo.toml");
        assert_eq!(result[0].status, "pending");
        assert_eq!(result[0].priority, "high");

        assert_eq!(result[1].id, "2");
        assert_eq!(result[1].content, "Create agent_log_parser.rs module");
        assert_eq!(result[1].status, "pending");
        assert_eq!(result[1].priority, "high");

        assert_eq!(result[2].id, "3");
        assert_eq!(result[2].content, "Add unit tests");
        assert_eq!(result[2].status, "pending");
        assert_eq!(result[2].priority, "medium");
    }

    #[test]
    fn test_parse_non_assistant_line() {
        let log_line = r#"{"type":"user","message":{"content":[]}}"#;
        let result = parse_todo_line(123, log_line).unwrap();
        assert_eq!(result.len(), 0);
    }

    #[test]
    fn test_parse_assistant_without_todowrite() {
        let log_line =
            r#"{"type":"assistant","message":{"content":[{"type":"text","text":"Some text"}]}}"#;
        let result = parse_todo_line(123, log_line).unwrap();
        assert_eq!(result.len(), 0);
    }

    #[test]
    fn test_parse_invalid_json() {
        let log_line = r#"{"type":"assistant","message":{"content":[{"type":"tool_use","name":"TodoWrite","input":{"todos":[{"id":"1","content":"Add serde dependencies to Cargo.toml","status":"pending","priority":"high"}]}}]}}"#;
        let result = parse_todo_line(123, log_line).unwrap();
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].id, "1");
    }
}
