import { MigrationInterface, QueryRunner } from "typeorm";

export class ChatbotCostViews1785496315777 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE VIEW v_chatbot_cost_by_day AS
            SELECT
            DATE(created_at) AS day,
            COUNT(*) AS assistant_responses,
            SUM(prompt_tokens) AS total_prompt_tokens,
            SUM(completion_tokens) AS total_completion_tokens,
            SUM(total_tokens) AS total_tokens,
            ROUND(
                (SUM(prompt_tokens)::numeric / 1000000 * 0.59)
                + (SUM(completion_tokens)::numeric / 1000000 * 0.79),
                4
            ) AS estimated_cost_usd,
            ROUND(AVG(latency_ms)::numeric, 0) AS avg_latency_ms
            FROM chat_messages
            WHERE role = 'assistant'
            GROUP BY DATE(created_at)
            ORDER BY day;
        `);

         await queryRunner.query(`
            CREATE VIEW v_chatbot_cost_by_user AS
            SELECT
                c.user_id,
                COUNT(*) AS assistant_responses,
                SUM(m.prompt_tokens) AS total_prompt_tokens,
                SUM(m.completion_tokens) AS total_completion_tokens,
                ROUND(
                (SUM(m.prompt_tokens)::numeric / 1000000 * 0.59)
                + (SUM(m.completion_tokens)::numeric / 1000000 * 0.79),
                4
                ) AS estimated_cost_usd
            FROM chat_messages m
            JOIN chat_conversations c ON c.id = m.conversation_id
            WHERE m.role = 'assistant'
            GROUP BY c.user_id
            ORDER BY estimated_cost_usd DESC;
            `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP VIEW v_chatbot_cost_by_day;`);
        await queryRunner.query('DROP VIEW v_chatbot_cost_by_user;');
    }

}
