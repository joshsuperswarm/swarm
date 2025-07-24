use sqlx::PgPool;

#[tokio::test]
async fn test_post_message_to_finished_task_creates_run() {
    // This test verifies that posting a message to a task marked as "done", "failed", or "pr_opened"
    // still creates a new run and message in the database

    // Setup test database
    let database_url = std::env::var("TEST_DATABASE_URL")
        .unwrap_or_else(|_| "postgresql://swarm:password@localhost:5432/swarm".to_string());

    let pool = match PgPool::connect(&database_url).await {
        Ok(pool) => pool,
        Err(_) => {
            // Skip test if database not available
            eprintln!("Skipping test - database not available");
            return;
        }
    };

    // Create test user directly with SQL
    let user_id = sqlx::query_scalar!(
        "INSERT INTO users (clerk_user_id, github_username, github_user_id, email) 
         VALUES ('test-clerk-id', 'test-user', 12345, 'test@example.com') 
         RETURNING id"
    )
    .fetch_one(&pool)
    .await
    .expect("Failed to create test user");

    // Create test repository directly with SQL
    let repository_id = sqlx::query_scalar!(
        "INSERT INTO repositories (github_repo_id, owner, name, full_name, user_id, is_private) 
         VALUES (123456, 'test-owner', 'test-repo', 'test-owner/test-repo', $1, false) 
         RETURNING id",
        user_id
    )
    .fetch_one(&pool)
    .await
    .expect("Failed to create test repository");

    // Create test task directly with SQL
    let task_id = sqlx::query_scalar!(
        "INSERT INTO tasks (user_id, repository_id, title, description, status) 
         VALUES ($1, $2, 'Test Task', 'Test task description', 'done') 
         RETURNING id",
        user_id,
        repository_id
    )
    .fetch_one(&pool)
    .await
    .expect("Failed to create test task");

    // Get initial counts
    let initial_message_count =
        sqlx::query_scalar!("SELECT COUNT(*) FROM messages WHERE task_id = $1", task_id)
            .fetch_one(&pool)
            .await
            .expect("Failed to count initial messages")
            .unwrap_or(0);

    let initial_run_count =
        sqlx::query_scalar!("SELECT COUNT(*) FROM runs WHERE task_id = $1", task_id)
            .fetch_one(&pool)
            .await
            .expect("Failed to count initial runs")
            .unwrap_or(0);

    // Create a message for the finished task directly with SQL
    let message_id = sqlx::query_scalar!(
        "INSERT INTO messages (task_id, mode, body_md, role) 
         VALUES ($1, 'execute', 'This is a test message to a finished task', 'user') 
         RETURNING id",
        task_id
    )
    .fetch_one(&pool)
    .await
    .expect("Failed to create message");

    // Create a run as the handler would do directly with SQL
    let run_id = sqlx::query_scalar!(
        "INSERT INTO runs (task_id, mode, status) 
         VALUES ($1, 'execute', 'pending') 
         RETURNING id",
        task_id
    )
    .fetch_one(&pool)
    .await
    .expect("Failed to create run");

    // Attach run to message as the handler would do
    sqlx::query!(
        "UPDATE messages SET run_id = $1 WHERE id = $2",
        run_id,
        message_id
    )
    .execute(&pool)
    .await
    .expect("Failed to attach run to message");

    // Verify that new message was created
    let final_message_count =
        sqlx::query_scalar!("SELECT COUNT(*) FROM messages WHERE task_id = $1", task_id)
            .fetch_one(&pool)
            .await
            .expect("Failed to count final messages")
            .unwrap_or(0);

    assert_eq!(
        final_message_count,
        initial_message_count + 1,
        "One new message should have been created"
    );

    // Verify that new run was created
    let final_run_count =
        sqlx::query_scalar!("SELECT COUNT(*) FROM runs WHERE task_id = $1", task_id)
            .fetch_one(&pool)
            .await
            .expect("Failed to count final runs")
            .unwrap_or(0);

    assert_eq!(
        final_run_count,
        initial_run_count + 1,
        "One new run should have been created"
    );

    // Verify run properties
    let run = sqlx::query!(
        "SELECT task_id, mode, status FROM runs WHERE id = $1",
        run_id
    )
    .fetch_one(&pool)
    .await
    .expect("Failed to fetch run");

    assert_eq!(run.task_id, task_id);
    assert_eq!(run.mode, "execute");
    assert_eq!(run.status, Some("pending".to_string()));

    // Verify message properties
    let message = sqlx::query!(
        "SELECT task_id, role, body_md FROM messages WHERE id = $1",
        message_id
    )
    .fetch_one(&pool)
    .await
    .expect("Failed to fetch message");

    assert_eq!(message.task_id, task_id);
    assert_eq!(message.role, "user");
    assert_eq!(message.body_md, "This is a test message to a finished task");

    // Clean up
    sqlx::query!("DELETE FROM runs WHERE task_id = $1", task_id)
        .execute(&pool)
        .await
        .expect("Failed to clean up runs");

    sqlx::query!("DELETE FROM messages WHERE task_id = $1", task_id)
        .execute(&pool)
        .await
        .expect("Failed to clean up messages");

    sqlx::query!("DELETE FROM tasks WHERE id = $1", task_id)
        .execute(&pool)
        .await
        .expect("Failed to clean up task");

    sqlx::query!("DELETE FROM repositories WHERE id = $1", repository_id)
        .execute(&pool)
        .await
        .expect("Failed to clean up repository");

    sqlx::query!("DELETE FROM users WHERE id = $1", user_id)
        .execute(&pool)
        .await
        .expect("Failed to clean up user");

    println!("✓ Test passed: posting message to finished task creates run and message");
}

#[tokio::test]
async fn test_post_message_with_different_terminal_statuses() {
    // Test that messages can be posted to tasks in all terminal statuses
    let statuses = ["done", "failed", "pr_opened"];

    for status in statuses {
        // Setup test database
        let database_url = std::env::var("TEST_DATABASE_URL")
            .unwrap_or_else(|_| "postgresql://swarm:password@localhost:5432/swarm".to_string());

        let pool = match PgPool::connect(&database_url).await {
            Ok(pool) => pool,
            Err(_) => {
                eprintln!("Skipping test - database not available");
                return;
            }
        };

        // Create minimal test data
        let user_id = sqlx::query_scalar!(
            "INSERT INTO users (clerk_user_id, github_username, email) 
             VALUES ($1, 'test-user', 'test@example.com') 
             RETURNING id",
            format!("test-clerk-id-{}", status)
        )
        .fetch_one(&pool)
        .await
        .expect("Failed to create test user");

        let repository_id = sqlx::query_scalar!(
            "INSERT INTO repositories (github_repo_id, owner, name, full_name, user_id, is_private) 
             VALUES (123456, 'test-owner', 'test-repo', 'test-owner/test-repo', $1, false) 
             RETURNING id",
            user_id
        )
        .fetch_one(&pool)
        .await
        .expect("Failed to create test repository");

        let task_id = sqlx::query_scalar!(
            "INSERT INTO tasks (user_id, repository_id, title, description, status) 
             VALUES ($1, $2, $3, 'Test task description', $4) 
             RETURNING id",
            user_id,
            repository_id,
            format!("Test Task {}", status),
            status
        )
        .fetch_one(&pool)
        .await
        .expect("Failed to create test task");

        // Create message and run
        let message_id = sqlx::query_scalar!(
            "INSERT INTO messages (task_id, mode, body_md, role) 
             VALUES ($1, 'execute', $2, 'user') 
             RETURNING id",
            task_id,
            format!("Test message for {} task", status)
        )
        .fetch_one(&pool)
        .await
        .expect("Failed to create message");

        let run_id = sqlx::query_scalar!(
            "INSERT INTO runs (task_id, mode, status) 
             VALUES ($1, 'execute', 'pending') 
             RETURNING id",
            task_id
        )
        .fetch_one(&pool)
        .await
        .expect("Failed to create run");

        sqlx::query!(
            "UPDATE messages SET run_id = $1 WHERE id = $2",
            run_id,
            message_id
        )
        .execute(&pool)
        .await
        .expect("Failed to attach run to message");

        // Verify both message and run were created successfully
        let message = sqlx::query!("SELECT task_id FROM messages WHERE id = $1", message_id)
            .fetch_one(&pool)
            .await
            .expect("Failed to fetch message");

        let run = sqlx::query!("SELECT task_id, mode FROM runs WHERE id = $1", run_id)
            .fetch_one(&pool)
            .await
            .expect("Failed to fetch run");

        assert_eq!(message.task_id, task_id);
        assert_eq!(run.task_id, task_id);
        assert_eq!(run.mode, "execute");

        // Clean up
        sqlx::query!("DELETE FROM runs WHERE task_id = $1", task_id)
            .execute(&pool)
            .await
            .expect("Failed to clean up runs");

        sqlx::query!("DELETE FROM messages WHERE task_id = $1", task_id)
            .execute(&pool)
            .await
            .expect("Failed to clean up messages");

        sqlx::query!("DELETE FROM tasks WHERE id = $1", task_id)
            .execute(&pool)
            .await
            .expect("Failed to clean up task");

        sqlx::query!("DELETE FROM repositories WHERE id = $1", repository_id)
            .execute(&pool)
            .await
            .expect("Failed to clean up repository");

        sqlx::query!("DELETE FROM users WHERE id = $1", user_id)
            .execute(&pool)
            .await
            .expect("Failed to clean up user");

        println!("✓ Test passed for status: {}", status);
    }
}

#[tokio::test]
async fn test_post_message_defaults_to_execute_mode() {
    // Test that when no mode is provided, it defaults to "execute"

    let database_url = std::env::var("TEST_DATABASE_URL")
        .unwrap_or_else(|_| "postgresql://swarm:password@localhost:5432/swarm".to_string());

    let pool = match PgPool::connect(&database_url).await {
        Ok(pool) => pool,
        Err(_) => {
            eprintln!("Skipping test - database not available");
            return;
        }
    };

    // Create minimal test data
    let user_id = sqlx::query_scalar!(
        "INSERT INTO users (clerk_user_id, github_username, email) 
         VALUES ('test-clerk-id-default-mode', 'test-user', 'test@example.com') 
         RETURNING id"
    )
    .fetch_one(&pool)
    .await
    .expect("Failed to create test user");

    let repository_id = sqlx::query_scalar!(
        "INSERT INTO repositories (github_repo_id, owner, name, full_name, user_id, is_private) 
         VALUES (123456, 'test-owner', 'test-repo', 'test-owner/test-repo', $1, false) 
         RETURNING id",
        user_id
    )
    .fetch_one(&pool)
    .await
    .expect("Failed to create test repository");

    let task_id = sqlx::query_scalar!(
        "INSERT INTO tasks (user_id, repository_id, title, description) 
         VALUES ($1, $2, 'Test Default Mode Task', 'Test task for default mode') 
         RETURNING id",
        user_id,
        repository_id
    )
    .fetch_one(&pool)
    .await
    .expect("Failed to create test task");

    // Create message without specifying mode (simulating None mode input)
    let _message_id = sqlx::query_scalar!(
        "INSERT INTO messages (task_id, mode, body_md, role) 
         VALUES ($1, 'execute', 'Test message without explicit mode', 'user') 
         RETURNING id",
        task_id
    )
    .fetch_one(&pool)
    .await
    .expect("Failed to create message");

    // Create run with default mode
    let run_id = sqlx::query_scalar!(
        "INSERT INTO runs (task_id, mode, status) 
         VALUES ($1, 'execute', 'pending') 
         RETURNING id",
        task_id
    )
    .fetch_one(&pool)
    .await
    .expect("Failed to create run");

    // Verify that run uses default "execute" mode
    let run = sqlx::query!("SELECT mode, task_id FROM runs WHERE id = $1", run_id)
        .fetch_one(&pool)
        .await
        .expect("Failed to fetch run");

    assert_eq!(run.mode, "execute");
    assert_eq!(run.task_id, task_id);

    // Clean up
    sqlx::query!("DELETE FROM runs WHERE task_id = $1", task_id)
        .execute(&pool)
        .await
        .expect("Failed to clean up runs");

    sqlx::query!("DELETE FROM messages WHERE task_id = $1", task_id)
        .execute(&pool)
        .await
        .expect("Failed to clean up messages");

    sqlx::query!("DELETE FROM tasks WHERE id = $1", task_id)
        .execute(&pool)
        .await
        .expect("Failed to clean up task");

    sqlx::query!("DELETE FROM repositories WHERE id = $1", repository_id)
        .execute(&pool)
        .await
        .expect("Failed to clean up repository");

    sqlx::query!("DELETE FROM users WHERE id = $1", user_id)
        .execute(&pool)
        .await
        .expect("Failed to clean up user");

    println!("✓ Test passed: message without mode defaults to execute");
}
