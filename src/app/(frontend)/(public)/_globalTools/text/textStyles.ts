/**
 * Wabi-Sabi Editorial Styles for Markdown Preview
 * Encapsulates all styling logic to avoid specificity battles and !important usage.
 */

const SABI_GOLD = "#9f890e"

export const editorialStyles = `
  /* Use a high-specificity wrapper class to override Tailwind Prose without !important */
  .wabi-editorial-prose.prose {
    max-width: none;
    font-family: serif;
    color: rgba(0, 0, 0, 0.85);
  }

  /* List Container reset */
  .wabi-editorial-prose.prose ul, 
  .wabi-editorial-prose.prose ol {
    margin-top: 0.5rem;
    margin-bottom: 0.5rem;
    padding-left: 1.5rem;
    display: block;
    float: none;
    clear: both;
  }

  /* List Item reset */
  .wabi-editorial-prose.prose li {
    margin-top: 0.125rem;
    margin-bottom: 0.125rem;
    line-height: 1.5;
    display: list-item;
    width: 100%;
  }

  /* Vertical stacking for nested lists */
  .wabi-editorial-prose.prose li > ul,
  .wabi-editorial-prose.prose li > ol {
    display: block;
    width: 100%;
    margin-top: 0.25rem;
    margin-left: 0;
  }

  /* Editorial Marker Hierarchy: 1. a. i. 1. */
  .wabi-editorial-prose.prose ol { list-style-type: decimal; }
  .wabi-editorial-prose.prose ol ol, 
  .wabi-editorial-prose.prose ul ol { list-style-type: lower-alpha; }
  .wabi-editorial-prose.prose ol ol ol, 
  .wabi-editorial-prose.prose ul ol ol { list-style-type: lower-roman; }
  .wabi-editorial-prose.prose ol ol ol ol, 
  .wabi-editorial-prose.prose ul ol ol ol { list-style-type: decimal; }

  /* Task List (Checkbox) Support */
  .wabi-editorial-prose.prose ul.contains-task-list,
  .wabi-editorial-prose.prose ul:has(.markdown-checkbox) {
    list-style: none;
    padding-left: 0;
  }

  .wabi-editorial-prose.prose li.task-list-item,
  .wabi-editorial-prose.prose li.task-list-item-styled {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    list-style: none;
    padding-left: 0;
    width: 100%;
  }

  /* Checkbox logic part */
  .wabi-editorial-prose .markdown-checkbox {
    appearance: none;
    -webkit-appearance: none;
    flex: none;
    width: 1.125rem;
    height: 1.125rem;
    border: 2px solid ${SABI_GOLD};
    border-radius: 3px;
    margin-right: 0.75rem;
    margin-top: 0.35rem;
    cursor: pointer;
    position: relative;
    background: transparent;
    transition: all 0.15s ease;
  }

  .wabi-editorial-prose .markdown-checkbox:checked {
    background-color: ${SABI_GOLD};
    border-color: ${SABI_GOLD};
  }

  .wabi-editorial-prose .markdown-checkbox:checked::after {
    content: "\\2713";
    color: white;
    font-size: 0.75rem;
    font-weight: bold;
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    line-height: 1;
  }

  /* Content of task item */
  .wabi-editorial-prose.prose li.task-list-item > *:not(ul):not(ol):not(.markdown-checkbox) {
    flex: 1 1 0%;
    margin-top: 0;
    margin-bottom: 0;
    min-width: 0;
  }

  /* Nested lists inside checkboxes: force new line and indent */
  .wabi-editorial-prose.prose li.task-list-item > ul,
  .wabi-editorial-prose.prose li.task-list-item > ol {
    flex: 0 0 100%;
    margin-left: 1.875rem;
    margin-top: 0.25rem;
  }

  /* General elements */
  .wabi-editorial-prose.prose p {
    margin-top: 0.5rem;
    margin-bottom: 0.5rem;
    line-height: 1.6;
  }

  .wabi-editorial-prose.prose blockquote {
    border-left: 4px solid ${SABI_GOLD};
    padding-left: 1rem;
    font-style: italic;
    color: rgba(0, 0, 0, 0.6);
  }

  .wabi-editorial-prose.prose a {
    color: ${SABI_GOLD};
    text-decoration: none;
    border-bottom: 1px solid transparent;
    transition: border-color 0.2s;
  }

  .wabi-editorial-prose.prose a:hover {
    border-bottom-color: ${SABI_GOLD};
  }
`
