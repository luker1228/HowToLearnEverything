/**
 * Reusable retrieval-practice quiz widget.
 *
 * Two quiz shapes, both driven by markup so lessons stay plain HTML:
 *
 * 1. Free recall — user types an answer, we fuzzy-match against accepted strings.
 *      <div class="quiz" data-answer="answer one;alternate answer">
 *        <div class="q-prompt">...question...</div>
 *        <input type="text" class="q-input" placeholder="...">
 *        <button class="q-check">检查</button>
 *        <button class="q-reveal">显示答案</button>
 *        <div class="q-feedback"></div>
 *      </div>
 *
 * 2. Choice — user clicks one option; mark the right one with data-correct.
 *      <div class="quiz" data-type="choice">
 *        <div class="q-prompt">...question...</div>
 *        <div class="q-options">
 *          <button class="q-option" data-correct="true">...</button>
 *          <button class="q-option">...</button>
 *        </div>
 *        <div class="q-feedback"></div>
 *      </div>
 *
 * Keep every option in a choice quiz the same rough length — the format
 * itself should never hint at the right answer.
 */
(function () {
	function normalize(s) {
		return s
			.trim()
			.toLowerCase()
			.replace(/[`'"]/g, "")
			.replace(/\s+/g, " ");
	}

	function initFreeRecall(quiz) {
		const raw = quiz.dataset.answer || "";
		const accepted = raw.split(";").map(normalize).filter(Boolean);
		const input = quiz.querySelector(".q-input");
		const checkBtn = quiz.querySelector(".q-check");
		const revealBtn = quiz.querySelector(".q-reveal");
		const feedback = quiz.querySelector(".q-feedback");

		function show(message, cls) {
			feedback.textContent = message;
			feedback.className = "q-feedback show " + cls;
		}

		if (checkBtn) {
			checkBtn.addEventListener("click", () => {
				const value = normalize(input.value || "");
				if (!value) return;
				const isCorrect = accepted.some((a) => value === a || value.includes(a) || a.includes(value));
				if (isCorrect) {
					show("✓ 对了。", "correct");
				} else {
					show("✗ 还没对，再想想，或点击「显示答案」。", "incorrect");
				}
			});
			input.addEventListener("keydown", (e) => {
				if (e.key === "Enter") checkBtn.click();
			});
		}

		if (revealBtn) {
			revealBtn.addEventListener("click", () => {
				show("参考答案：" + raw.split(";")[0], "incorrect");
			});
		}
	}

	function initChoice(quiz) {
		const options = quiz.querySelectorAll(".q-option");
		const feedback = quiz.querySelector(".q-feedback");
		let answered = false;

		options.forEach((opt) => {
			opt.addEventListener("click", () => {
				if (answered) return;
				answered = true;
				const correct = opt.dataset.correct === "true";
				options.forEach((o) => {
					o.disabled = true;
					if (o.dataset.correct === "true") {
						o.style.borderColor = "var(--good)";
						o.style.color = "var(--good)";
					}
				});
				if (!correct) {
					opt.style.borderColor = "var(--bad)";
					opt.style.color = "var(--bad)";
				}
				feedback.textContent = correct ? "✓ 对了。" : "✗ 不对，正确答案已高亮。";
				feedback.className = "q-feedback show " + (correct ? "correct" : "incorrect");
			});
		});
	}

	function init() {
		document.querySelectorAll(".quiz").forEach((quiz) => {
			if (quiz.dataset.type === "choice") {
				initChoice(quiz);
			} else {
				initFreeRecall(quiz);
			}
		});
	}

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", init);
	} else {
		init();
	}
})();
