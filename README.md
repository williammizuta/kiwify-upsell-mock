# kiwify-upsell-mock

Página de upsell de mentira para testar o **upsell de 1 clique** da Kiwify no ambiente **dev**.

A página imita a página de obrigado de um produtor: uma landing page de vendas com o mesmo HTML que o
*Gerador de upsell* do dashboard entrega ao produtor, mais o script `upsell-v2-dev`. Ela também monta um
funil com **upsell 1**, **upsell 2** (depois de aceitar) e **downsell** (depois de recusar).

É um site estático: `index.html`, `styles.css` e `app.js`. Não tem build nem dependências.

## Como usar

1. No dashboard de dev, crie as ofertas do funil e anote o **ID do link** de cada uma. É o código que o
   *Gerador de upsell* coloca no HTML: `kiwify-upsell-trigger-<ID>` (ex.: `oRA9f06`).
2. Abra a página sem parâmetros. Ela mostra um formulário para montar o funil.
3. Preencha o upsell 1 (obrigatório), o upsell 2 e o downsell (opcionais). Se quiser, mude o texto e a cor
   do botão, como no *Gerador de upsell*.
4. Copie a URL gerada.
5. No produto principal, em **Página de obrigado e upsell**, marque *Esse produto tem uma página de obrigado
   personalizada ou upsell* e cole a URL.
6. Compre o produto principal no checkout de dev. Depois da aprovação, o checkout redireciona para esta página.

O botão *Abrir prévia sem token* mostra a página sem passar pelo checkout. Serve para ver o layout, mas a
compra de 1 clique não funciona sem `token`.

## Funil

```text
Checkout ──▶ Upsell 1 ──aceitou──▶ Upsell 2 ──▶ acesso ao produto
            (link-id) │            (upsell)
                      └──recusou──▶ Downsell ──▶ acesso ao produto
                                   (downsell)
```

- O upsell 1 usa `data-upsell-url` e `data-downsell-url` para apontar para esta mesma página, na etapa seguinte.
- O upsell 2 e o downsell terminam o funil com o comportamento padrão da Kiwify: o script leva o comprador
  para `/student/password/<code_senha>` do dashboard de dev.
- Sem upsell 2 ou sem downsell, o ramo correspondente também termina com o comportamento padrão.

## Parâmetros da URL

Parâmetros que a página usa:

| Parâmetro      | Obrigatório | Descrição                                                        |
| -------------- | ----------- | ---------------------------------------------------------------- |
| `link-id`      | sim         | ID do link do upsell 1, a primeira oferta.                       |
| `upsell`       | não         | ID do link do upsell 2, mostrado depois que o comprador aceita o upsell 1. |
| `downsell`     | não         | ID do link do downsell, mostrado depois que o comprador recusa o upsell 1. |
| `step`         | não         | Etapa atual: `link-id` (padrão), `upsell` ou `downsell`. A própria página define este valor. |
| `accept-text`  | não         | Texto do botão de aceitar. Padrão: *Sim, eu aceito essa oferta especial!* |
| `decline-text` | não         | Texto do link de recusar. Padrão: *Não, eu gostaria de recusar essa oferta* |
| `color`        | não         | Cor do botão em hex (`#2563eb`). A página também usa esta cor como destaque. |

Parâmetros que o checkout adiciona: `token`, `code_senha`, `amount`, `payment_type`, `payment_version`,
`kw-country`, `kw-parent-currency`, `order_code` e `subdominio`. O script repassa só parte deles para a etapa
seguinte (veja [Cuidados](#cuidados)). O painel **🛠️ Dev**, no canto da página, mostra todos os parâmetros
recebidos.

## De onde vêm os dados

- **Oferta**: `GET https://checkout-api-dev.kiwify.com.br/link/<ID>?upsell=yes`, o mesmo endpoint da
  payment-api que o script de upsell chama. A página usa o nome do produto e da oferta, o preço, as parcelas,
  a imagem do produto, o vendedor e o e-mail de suporte.
- **Botão de upsell**: `https://snippets.kiwify.com/upsell-v2-dev/upsell.min.js`, publicado pelo repositório
  `kiwify/kiwify-snippets`.
- **HTML do botão**: o mesmo formato do `scoped-components/products/UpsellGenerator.vue`, do
  `dashboard-main-kiwify`.

## Rodar localmente

```bash
python3 -m http.server 8000
```

Abra <http://localhost:8000>. A URL de `localhost` também funciona como página de obrigado no produto de dev,
porque o redirecionamento acontece no navegador de quem compra.

## Cuidados

- Não declare as variáveis globais `nextUpsellURL` e `nextDownsellURL`. O script de upsell usa essas variáveis
  antes dos atributos `data-*`, e um valor vazio desliga o funil.
- O `token` vale para uma única compra. Depois de aceitar uma oferta, o script recebe um token novo e o envia
  para a etapa seguinte. Se o comprador aceitar de novo com um token usado, a API responde `USED_TOKEN` e o
  script termina o funil.
- O script não repassa `kw-country`, `kw-state` nem `kw-zipcode` para a etapa seguinte. Nas etapas seguintes,
  o país fica `BR`.
- Quando o comprador aceita pelo formulário de cartão, o script também não repassa `payment_type`. A etapa
  seguinte abre como cartão de crédito.
