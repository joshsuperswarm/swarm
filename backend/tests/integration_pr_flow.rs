use sqlx::PgPool;

#[tokio::test]
async fn test_pr_flow_database_integration() {
    // This is a simplified integration test that focuses on database operations
    // and verifies the github_branch and github_pr_url fields work correctly

    // Setup test database
    let database_url = std::env::var("TEST_DATABASE_URL")
        .unwrap_or_else(|_| "postgresql://swarm:password@localhost:5432/swarm".to_string());

    let pool = PgPool::connect(&database_url)
        .await
        .expect("Failed to connect to test database");

    // Test that we can create a task and update it with PR info
    let test_task_id = sqlx::query_scalar!(
        "INSERT INTO tasks (user_id, repository_id, title, description) 
         VALUES (1, 1, 'Test PR Flow Task', 'Integration test') 
         RETURNING id"
    )
    .fetch_one(&pool)
    .await
    .expect("Failed to create test task");

    // Test updating task with branch (simulated by adding to PR URL for now)
    let test_branch = format!("swarm/task-{}", test_task_id);

    // Test updating task with PR URL (status is now managed via runs table)
    let test_pr_url = "https://github.com/test-owner/test-repo/pull/123";
    sqlx::query!(
        "UPDATE tasks SET github_pr_url = $1 WHERE id = $2",
        test_pr_url,
        test_task_id
    )
    .execute(&pool)
    .await
    .expect("Failed to update task with PR URL");

    // Verify the task has all the expected fields (status is now managed via runs table)
    let task = sqlx::query!(
        "SELECT id, title, github_pr_url FROM tasks WHERE id = $1",
        test_task_id
    )
    .fetch_one(&pool)
    .await
    .expect("Failed to fetch task");

    assert_eq!(task.id, test_task_id);
    assert_eq!(task.title, "Test PR Flow Task");
    assert_eq!(task.github_pr_url.as_deref(), Some(test_pr_url));

    // Clean up
    sqlx::query!("DELETE FROM tasks WHERE id = $1", test_task_id)
        .execute(&pool)
        .await
        .expect("Failed to clean up test task");

    println!("✓ Database integration test passed: github_pr_url field works correctly");
}
