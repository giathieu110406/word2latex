const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

const searchStr = `                  </div>
              </div>
          </div>
      <div className="max-w-[1600px] mx-auto w-full px-4 sm:px-6 md:px-10 lg:px-12 py-4 md:py-8 flex-1 flex flex-col gap-4 md:gap-6 overflow-x-hidden">`;

const replaceStr = `                  </div>
              </div>
          </div>
          
          <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
            <div className="max-w-[1600px] mx-auto w-full px-4 sm:px-6 md:px-10 lg:px-12 py-4 md:py-6 flex-1 flex flex-col gap-4 md:gap-6">`;

const idx = code.indexOf(searchStr);
if (idx !== -1) {
    code = code.substring(0, idx) + replaceStr + code.substring(idx + searchStr.length);
    fs.writeFileSync('src/App.tsx', code);
    console.log('Replaced!');
} else {
    console.log('Not found!');
}
