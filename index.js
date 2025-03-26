require("dotenv").config();
const { Telegraf, Markup } = require("telegraf");
const mongoose = require("mongoose");

// Load environment variables
const BOT_TOKEN = process.env.BOT_TOKEN;
const MONGO_URI = process.env.MONGO_URI;

// Connect to MongoDB
mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log("✅ Connected to MongoDB"))
    .catch(err => console.log("❌ MongoDB Connection Error:", err));

// Define MongoDB Schema
const userSchema = new mongoose.Schema({
    user_id: Number,
    first_name: String,
    score: { type: Number, default: 0 }
});
const User = mongoose.model("User", userSchema);

// Initialize Bot
const bot = new Telegraf(BOT_TOKEN);

// Word List
const words = ["python", "telegram", "developer", "computer", "database", "network",
    "algorithm", "programming", "software", "hardware", "compiler", "debugging",
    "server", "client", "encryption", "firewall", "processor", "keyboard",
    "monitor", "operating", "system", "cloud", "storage", "artificial",
    "intelligence", "machine", "learning", "cybersecurity", "data", "structure",
    "queue", "stack", "binary", "search", "tree", "graph", "linked", "list",
    "hashing", "sorting", "recursion", "function", "variable", "loop",
    "exception", "object", "inheritance", "polymorphism", "encapsulation",
    "framework", "library", "database", "query", "indexing", "normalization",
    "primary", "foreign", "key", "join", "aggregation", "web", "frontend",
    "backend", "fullstack", "api", "request", "response", "authentication"];

// Store active games
const userGames = new Map();

// Start Command
bot.start(async (ctx) => {
    const userId = ctx.from.id;
    const firstName = ctx.from.first_name;

    // Store user in MongoDB if not already stored
    let user = await User.findOne({ user_id: userId });
    if (!user) {
        user = new User({ user_id: userId, first_name: firstName });
        await user.save();
    }

    await ctx.reply(
        `🎮 Welcome ${firstName}! Let's play Word Guessing Game!\nClick below to start.`,
        Markup.inlineKeyboard([Markup.button.callback("🎮 Play Game", "play")])
    );
});

// Play Command
bot.action("play", async (ctx) => {
    const userId = ctx.from.id;

    // Select a random word
    const word = words[Math.floor(Math.random() * words.length)];
    const hiddenWord = "_".repeat(word.length);

    // Store game state
    userGames.set(userId, { word, hiddenWord, attempts: 6, guessed: [] });

    await ctx.reply(`🔠 Guess the word: ${hiddenWord}\n\nEnter a letter:`);
});

// Handle User Guesses
bot.on("text", async (ctx) => {
    const userId = ctx.from.id;
    const guess = ctx.message.text.toLowerCase();

    if (!userGames.has(userId)) {
        return ctx.reply("❌ You haven't started a game yet. Click 'Play Game' to start.");
    }

    const game = userGames.get(userId);
    if (guess.length !== 1 || !/[a-z]/.test(guess)) {
        return ctx.reply("⚠️ Please enter a **single letter**.");
    }

    if (game.guessed.includes(guess)) {
        return ctx.reply("⚠️ You've already guessed that letter.");
    }

    game.guessed.push(guess);

    if (game.word.includes(guess)) {
        let newHiddenWord = "";
        for (let i = 0; i < game.word.length; i++) {
            newHiddenWord += game.word[i] === guess ? guess : game.hiddenWord[i];
        }
        game.hiddenWord = newHiddenWord;
        await ctx.reply(`✅ Correct! ${game.hiddenWord}`);
    } else {
        game.attempts -= 1;
        await ctx.reply(`❌ Wrong guess! Attempts left: ${game.attempts}`);
    }

    // Check win/loss
    if (!game.hiddenWord.includes("_")) {
        await ctx.reply(`🎉 You guessed it! The word was **${game.word}**.`);

        // Update user score
        let user = await User.findOne({ user_id: userId });
        user.score += 1;
        await user.save();

        // Check and pin highest score
        await pinHighestScore(ctx);

        userGames.delete(userId);
    } else if (game.attempts === 0) {
        await ctx.reply(
            `💀 Game Over! The word was **${game.word}**.`,
            Markup.inlineKeyboard([Markup.button.callback("🔄 Replay", "play")])
        );

        userGames.delete(userId);
    }
});

// Pin Highest Score in Chat
async function pinHighestScore(ctx) {
    const highestScorer = await User.find().sort({ score: -1 }).limit(1);
    if (highestScorer.length > 0) {
        const highestUser = highestScorer[0];
        const message = `🏆 **Highest Score:** ${highestUser.first_name} - ${highestUser.score} points!`;
        try {
            const sentMessage = await ctx.reply(message);
            await ctx.pinChatMessage(sentMessage.message_id);
        } catch (error) {
            console.error("Error pinning message:", error);
        }
    }
}

// Bot Launch
bot.launch().then(() => console.log("🤖 Bot is running..."));

// Graceful Stop
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
