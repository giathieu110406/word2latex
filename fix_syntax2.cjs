const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

const badBlock = `            </div>
          </div></div></div></div>
  );}`;

const goodBlock = `            </div>
          </div>
        </div>
      </div>
    </div>
  );
}`;

code = code.replace(badBlock, goodBlock);
fs.writeFileSync('src/App.tsx', code);
