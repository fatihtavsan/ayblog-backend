require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const logger = require("./logger");

const app = express();
app.use(
  cors({
    /* origin: "https://domain.com", */
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// --- POSTS GET ALL ---
app.get("/posts", async (req, res) => {
  try {
    const postsRes = await pool.query("SELECT * FROM posts ORDER BY date DESC");
    const posts = postsRes.rows;

    for (const post of posts) {
      const tagRes = await pool.query(
        `SELECT t.id, t.name FROM tags t
         JOIN post_tags pt ON pt.tag_id = t.id
         WHERE pt.post_id = $1`,
        [post.id]
      );
      post.tags = tagRes.rows;
    }

    res.json(posts);
  } catch (err) {
    logger.error(err.stack || err.message);
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// --- POST DELETE ---
app.delete("/posts/:id", async (req, res) => {
  const postId = req.params.id;

  try {
    await pool.query("DELETE FROM post_tags WHERE post_id = $1", [postId]);

    const result = await pool.query("DELETE FROM posts WHERE id = $1", [
      postId,
    ]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Post bulunamadı" });
    }

    res.json({ message: "Post başarıyla silindi" });
  } catch (err) {
    logger.error(err.stack || err.message);
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// --- POST GET BY ID ---
app.get("/posts/:id", async (req, res) => {
  const postId = req.params.id;
  try {
    const postRes = await pool.query("SELECT * FROM posts WHERE id = $1", [
      postId,
    ]);
    if (postRes.rows.length === 0)
      return res.status(404).json({ error: "Post bulunamadı" });
    const post = postRes.rows[0];

    const tagRes = await pool.query(
      `SELECT t.id, t.name FROM tags t
       JOIN post_tags pt ON pt.tag_id = t.id
       WHERE pt.post_id = $1`,
      [postId]
    );
    post.tags = tagRes.rows;

    res.json(post);
  } catch (err) {
    logger.error(err.stack || err.message);
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// POST CREATE
app.post("/posts", async (req, res) => {
  const { title, content, date, tags } = req.body;

  try {
    const tagIds = tags
      .map((tag) => tag.id || tag.value)
      .filter((id) => typeof id === "number");

    const insertPost = await pool.query(
      `INSERT INTO posts (title, content, date) VALUES ($1, $2, $3) RETURNING id`,
      [title, content, date]
    );
    const postId = insertPost.rows[0].id;

    for (const tagId of tagIds) {
      await pool.query(
        "INSERT INTO post_tags (post_id, tag_id) VALUES ($1, $2)",
        [postId, tagId]
      );
    }

    res.status(201).json({ id: postId });
  } catch (err) {
    logger.error(err.stack || err.message);
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// --- POST UPDATE ---
app.put("/posts/:id", async (req, res) => {
  const postId = req.params.id;
  const { title, content, date, tags } = req.body;

  try {
    await pool.query(
      "UPDATE posts SET title = $1, content = $2, date = $3 WHERE id = $4",
      [title, content, date, postId]
    );

    await pool.query("DELETE FROM post_tags WHERE post_id = $1", [postId]);

    const tagIds = tags
      .map((tag) => tag.id || tag.value)
      .filter((id) => typeof id === "number");

    for (const tagId of tagIds) {
      await pool.query(
        "INSERT INTO post_tags (post_id, tag_id) VALUES ($1, $2)",
        [postId, tagId]
      );
    }

    res.json({ message: "Post başarıyla güncellendi" });
  } catch (err) {
    logger.error(err.stack || err.message);
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// --- TAGS GET ALL ---
app.get("/tags", async (req, res) => {
  try {
    const tagRes = await pool.query("SELECT * FROM tags ORDER BY name");
    res.json(tagRes.rows);
  } catch (err) {
    logger.error(err.stack || err.message);
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// --- TAG CREATE ---
app.post("/tags", async (req, res) => {
  const { name } = req.body;
  try {
    const insertTag = await pool.query(
      `INSERT INTO tags (name) VALUES ($1) RETURNING *`,
      [name]
    );
    res.status(201).json(insertTag.rows[0]);
  } catch (err) {
    logger.error(err.stack || err.message);
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server ${PORT} portunda`));
