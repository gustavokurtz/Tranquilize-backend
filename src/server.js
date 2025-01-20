require("dotenv").config();
const express = require("express");
const { PrismaClient } = require("@prisma/client");
const fs = require("fs");

const app = express();
const prisma = new PrismaClient();

app.use(express.json());

// Função para carregar arquivos JSON com tratamento de erro
function carregarJSON(nomeArquivo) {
    try {
        return JSON.parse(fs.readFileSync(nomeArquivo, "utf-8"));
    } catch (error) {
        console.error(`Erro ao carregar ${nomeArquivo}:`, error);
        return {}; // Retorna um objeto vazio para evitar falhas
    }
}

// Carregar palavras-chave e respostas com tratamento de erro
const palavrasChave = carregarJSON("palavras_chave.json");
const respostas = carregarJSON("respostas.json");

// Função para normalizar texto e remover acentos
function corrigirTexto(texto) {
    if (typeof texto !== "string") return ""; // Evita erro de undefined
    return texto.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

app.post("/detectar", async (req, res) => {
    try {
        // Validação do corpo da requisição
        if (!req.body.text) {
            return res.status(400).json({ error: "O campo 'text' é obrigatório." });
        }

        const { text } = req.body;
        const textoCorrigido = corrigirTexto(text);

        const palavrasDetectadas = [];
        const respostasGeradas = [];

        // Detectar palavras-chave no texto
        for (const [chave, palavras] of Object.entries(palavrasChave)) {
            for (const palavra of palavras) {
                if (textoCorrigido.includes(corrigirTexto(palavra))) {
                    palavrasDetectadas.push(chave);
                    if (!respostasGeradas.includes(respostas[chave])) {
                        respostasGeradas.push(respostas[chave]);
                    }
                    break; // Evitar duplicação por sinônimos
                }
            }
        }

        // Combinar respostas com links e exercícios
let respostaFinal = "Não foi possível identificar algo específico. Caso precise, fale com um profissional de confiança.";
let links = [];
let exercicios = [];

if (respostasGeradas.length > 0) {
    respostaFinal = respostasGeradas.map(r => r.resposta).join(" Além disso, ");
    links = respostasGeradas.map(r => r.url);
    exercicios = respostasGeradas.map(r => r.exercicio);
}





        // Salvar no banco de dados
        const mensagem = await prisma.message.create({
            data: { text, response: respostaFinal },
        });

        res.json({ mensagem, resposta: respostaFinal, palavrasDetectadas, links, exercicios });

    } catch (error) {
        console.error("Erro no servidor:", error);
        res.status(500).json({ error: "Erro interno do servidor." });
    }
});



// Definir porta corretamente e exibir no console
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
