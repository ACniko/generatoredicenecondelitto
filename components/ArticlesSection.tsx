import React, { useState } from 'react';
import { guideArticles } from '../content/guideData';
import { BookOpenIcon } from './icons';

const ArticlesSection: React.FC = () => {
  const [expandedArticle, setExpandedArticle] = useState<string | null>(null);

  const toggleArticle = (id: string) => {
    setExpandedArticle((current) => (current === id ? null : id));
  };

  return (
    <section className="w-full max-w-5xl mx-auto py-12 space-y-8" aria-labelledby="guide-section">
      <header className="space-y-3 text-center">
        <h2 id="guide-section" className="text-3xl font-bold text-amber-200 flex items-center justify-center gap-3">
          <BookOpenIcon className="w-8 h-8 text-amber-300" aria-hidden="true" />
          Guide pratiche per organizzatori
        </h2>
        <p className="text-gray-300">
          Approfondimenti curati per costruire eventi di qualità e offrire ai tuoi ospiti un mistero memorabile.
        </p>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        {guideArticles.map((article) => {
          const isExpanded = expandedArticle === article.id;
          return (
            <article
              key={article.id}
              className="bg-gray-800/60 border border-gray-700 rounded-lg shadow-lg shadow-black/20 overflow-hidden flex flex-col"
            >
              <div className="p-6 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-semibold text-white">{article.title}</h3>
                    <p className="text-sm text-amber-200">{article.readingTime} di lettura</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleArticle(article.id)}
                    className="text-sm font-semibold text-amber-300 hover:text-amber-200 underline-offset-4 hover:underline"
                    aria-expanded={isExpanded}
                    aria-controls={`${article.id}-content`}
                  >
                    {isExpanded ? 'Nascondi approfondimento' : 'Leggi l approfondimento'}
                  </button>
                </div>
                <p className="text-gray-300">{article.summary}</p>
              </div>

              <div
                id={`${article.id}-content`}
                className={`transition-all duration-300 ${isExpanded ? 'max-h-[900px] opacity-100' : 'max-h-0 opacity-0'} overflow-hidden`}
              >
                <div className="p-6 pt-0 space-y-4 text-gray-200 text-sm leading-relaxed">
                  {article.body.map((paragraph, index) => (
                    <p key={index} className="text-justify">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
};

export default ArticlesSection;
