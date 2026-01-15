const sqliteConfig = {
    locateFile: filename => `node_modules/sql.js/dist/${filename}` // sql-wasm.wasm
};
const transactionsQuery = `
select datetime(t.UTIME / 1000, 'unixepoch') as dt,
       case
            when t.ctgUid is null then 'Transfer'
            when t.ctgUid like '-%' or subcategory.TYPE = 1 then 'Expense'   -- (Modified Balance) ctgUid negative (seems to be -4 only)
            when subcategory.TYPE = 0 then 'Income' 
       end as type,
       case 
            when t.ctgUid is null then 'Transfer'
            when t.ctgUid like '-%' then 'Modified Balance'    -- ctgUid negative (seems to be -4 only)
            when category.NAME is null then subcategory.NAME 
            else category.NAME
        end as category,
        case
            when category.NAME is null then null
            else subcategory.NAME
        end as subcategory,
        printf('%s %,d', c.SYMBOL, t.AMOUNT_ACCOUNT) as amount,
        case
            when t.ctgUid is null then printf('%s -> %s', assets.NIC_NAME, toAssets.NIC_NAME)
            else assets.NIC_NAME 
        end as asset,
        t.ZCONTENT as name, 
        t.ZDATA as description
from INOUTCOME t
left join ZCATEGORY subcategory on subcategory.uid = t.ctgUid
left join ZCATEGORY category on category.uid = subcategory.pUid
join assets on assets.uid = t.assetUid
left join ASSETS toAssets on toAssets.uid = t.toAssetUid
join CURRENCY c on c.uid = t.currencyUid
where t.IS_DEL = 0         -- not deleted
      and t.DO_TYPE != 4   -- not Transfer (from) [because its> duplicate Transfer (to) entry is already present]
      and t.ctgUid != ''   -- exclude Modified Balance entries where selected not to save as income/expense
order by t.UTIME desc
`;
const amountColours = {Income: 'blue', Expense: 'red', Transfer: 'black'};
const transactionsElem = document.getElementById('transactions');

async function sqliteDatabase(file) {
    const buf = await file.arrayBuffer();
    return new SQL.Database(new Uint8Array(buf));
}

/** Convert obj to string and escape html special characters - https://stackoverflow.com/a/6234804 .
 * @param {any} obj
 * @returns {string}
*/
function escapeHtml(obj) {
    return String(obj)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/** Render database query results as a table. 
 * @param {array} contents - Array of one or more fetched query table results. Each table object has columns and row values.
                    Format example: [{columns:['col1','col2',...], values:[[first row array], [second row array], ...]}]
*/
function dbQueryResultsToTables(contents) {
    let ans = '';
    for (const {columns, values} of contents) {
        ans += '<table>';
        ans += '<thead><tr>' + columns.map(escapeHtml).map(cell => `<th>${cell}</th>`).join('') + '</tr></thead>';  // table header
        ans += '<tbody>';
        for (const row of values) {
            ans += '<tr>' + row.map(escapeHtml).map(cell => `<td>${cell}</td>`).join('') + '</tr>';   // table query result rows
        }
        ans += '</tbody>';
        ans += '</table>';
    }
    return ans;
}

function zip(array1, array2) {    // ASSUMPTION: equal-length arrays
    return array1.map((x, index) => [x, array2[index]])
}

function dbQueryResultToRows({columns, values}) {
    return values.map(row => Object.fromEntries(zip(columns, row)));
}

function displayTransactions(db) {
    const {columns, values} = db.exec(transactionsQuery)[0];    // [0] since single query result table only
    let ans = '';
    for (const rarray of values) {
        const row = Object.fromEntries(zip(columns, rarray));
        ans += `
            <tr class="transaction-head"> 
                <td rowspan="${row.subcategory === null ? 2 : 1}">${row.category}</td> 
                ${row.name === '' ? `<td rowspan="2">${row.asset}</td>` : `<td style="color: black">${row.name}</td>` } 
                <td style="color: ${amountColours[row.type]}">${row.amount}</td> 
            </tr>
            <tr class="transaction-foot"> 
                ${row.subcategory === null ? '' : `<td style="font-size: smaller">${row.subcategory}</td>`} 
                ${row.name === '' ? '' : `<td>${row.asset}</td>`} 
                <td></td> 
            </tr>
        `;
    }
    transactionsElem.innerHTML = ans;
}

async function initDatabase(file) {
    window.db = await sqliteDatabase(file);
    displayTransactions(db);
}

async function main() {
    window.SQL = await initSqlJs(sqliteConfig);
    if (location.hostname === "localhost" || location.hostname === "127.0.0.1" || location.hostname === "") {
        await initDatabase(await fetch("MMAuto[GF260112](12-01-26-090617).mmbak"));
    }
}