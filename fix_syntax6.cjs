const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

const endStr = `            </footer>
          </div>
          </div>
    </div>
  );
}`;

const replacement = `            </footer>
          </div>
        </div>
      </div>
    </div>
  );
}`;

code = code.replace(endStr, replacement);
fs.writeFileSync('src/App.tsx', code);
