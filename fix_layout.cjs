const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

// 1. Fix the main wrapper to be a flex column with h-screen
// 2. Put the Topbar, then a flex-1 overflow-y-auto container
// 3. Inside it, put the views container and then the footer.

const oldWrapper = `      {/* MAIN CONTENT WRAPPER */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-y-auto">
          {/* TOPBAR */}`;

const newWrapper = `      {/* MAIN CONTENT WRAPPER */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
          {/* TOPBAR */}`;

code = code.replace(oldWrapper, newWrapper);

const oldContentStart = `                  </div>
              </div>
          </div>
      <div className="max-w-[1600px] mx-auto w-full px-4 sm:px-6 md:px-10 lg:px-12 py-4 md:py-8 flex-1 flex flex-col gap-4 md:gap-6 overflow-x-hidden">`;

const newContentStart = `                  </div>
              </div>
          </div>
          
          <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
            <div className="max-w-[1600px] mx-auto w-full px-4 sm:px-6 md:px-10 lg:px-12 py-4 md:py-6 flex-1 flex flex-col gap-4 md:gap-6">`;

code = code.replace(oldContentStart, newContentStart);

const oldFooterStart = `      <footer className="w-full text-center py-4 bg-white/50 border-t border-slate-200/60 mt-auto select-none px-4">`;
const newFooterStart = `            </div>
            {/* Footer */}
            <footer className="w-full text-center py-4 bg-white/50 border-t border-slate-200/60 mt-auto shrink-0 select-none px-4">`;

// Remove the old {/ * Footer * /} and the footer tag itself from its current location, and replace the whole block
const footerRegex = /\{\/\*\s*Footer\s*\*\/\}\s*<footer className="w-full text-center py-4 bg-white\/50 border-t border-slate-200\/60 mt-auto select-none px-4">[\s\S]*?<\/footer>/;
const matchedFooter = code.match(footerRegex);
if (matchedFooter) {
    code = code.replace(footerRegex, '');
    code = code.replace('            </div>\n          )}\n        </AnimatePresence>\n      </div>', 
                        '            </div>\n          )}\n        </AnimatePresence>\n      </div>\n' + newFooterStart + matchedFooter[0].replace('      {/* Footer */}\n', '').replace('      <footer className="w-full text-center py-4 bg-white/50 border-t border-slate-200/60 mt-auto select-none px-4">', '') + '\n          </div>');
}

fs.writeFileSync('src/App.tsx', code);
