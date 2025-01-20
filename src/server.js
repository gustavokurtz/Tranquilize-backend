require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const path = require("path");

const app = express();
const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Função para remover acentos e normalizar o texto
function corrigirTexto(texto) {
  return texto.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// Carregar palavras-chave e respostas
const palavrasChave = JSON.parse(fs.readFileSync(path.join(__dirname, "../palavras_chave.json"), "utf8"));
const respostas = JSON.parse(fs.readFileSync(path.join(__dirname, "../respostas.json"), "utf8"));

app.post("/detectar", async (req, res) => {
  try {
    if (!req.body.text) {
      return res.status(400).json({ error: "O campo 'text' é obrigatório." });
    }

    const { text } = req.body;
    console.log("Texto recebido:", text);

    const textoCorrigido = corrigirTexto(text);
    const palavrasDetectadas = [];
    const respostasGeradas = [];

    // Detecta palavras-chave e coleta as respostas
    for (const [chave, palavras] of Object.entries(palavrasChave)) {
      for (const palavra of palavras) {
        if (textoCorrigido.includes(corrigirTexto(palavra))) {
          palavrasDetectadas.push(chave);
          if (!respostasGeradas.some(r => JSON.stringify(r) === JSON.stringify(respostas[chave]))) {
            respostasGeradas.push(respostas[chave]);
          }
          break;
        }
      }
    }

    // Formatar a resposta final
    let respostaFinal = {
      resposta: "Não foi possível identificar algo específico. Caso precise, fale com um profissional de confiança.",
      url: null,
      exercicio: null
    };

    if (respostasGeradas.length === 1) {
      respostaFinal = respostasGeradas[0];
    } else if (respostasGeradas.length > 1) {
      respostaFinal = {
        resposta: respostasGeradas.map(r => r.resposta).join(" Além disso, "),
        url: respostasGeradas.find(r => r.url)?.url || null,
        exercicio: respostasGeradas.find(r => r.exercicio)?.exercicio || null
      };
    }

    // Salvar no banco de dados garantindo que `response` seja uma string JSON válida
    const mensagem = await prisma.message.create({
      data: {
        text,
        response: JSON.stringify(respostaFinal) // Agora salvamos JSON stringificado no banco
      }
    });

    // Retornar a resposta formatada corretamente ao frontend
    res.json({ mensagem, resposta: respostaFinal, palavrasDetectadas });

  } catch (error) {
    console.error("Erro no servidor:", error);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

// Inicia o servidor
const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
