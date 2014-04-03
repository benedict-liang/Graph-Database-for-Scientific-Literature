/**
 * The namespace for the parser class.
 * @namespace
 */
var parser = {};

/**
 * Parses the boolean query string into a mongo query object.
 *
 * The result can be run directly as a mongo query. If the query string
 * is invalid, an error will be printed and a null object will be returned.
 * 
 * @param query {string}: the query string to parse.
 * @param key {string}: the field that the query belongs to.
 * @return {Object|undefined}: the mongo query object or undefined (if the
 *      string cannot be parsed).
 */
parser.parseBooleanQuery = function (query, key) {
    var queryTokens = query.split(' ');

    // TODO: need to handle empty strings from list.

    // no boolean query
    if (queryTokens.length == 1) {
        return query;
    }

    var operators = ['&&', '||'];

    operators.forEach(function(operator) {
        queryTokens = handleBinaryOperator(operator, key, queryTokens);
    });

    return queryTokens[0]
};

/**
 * Handles the construction of a query object for a binary operator.
 *
 * @param operator {string}: the operator to handle (eg. '&&').
 * @param key {string}: the field that the query belongs to.
 * @param queryTokens {Array.<string|Object>}: the list of tokens to
 *      convert to a mongo query object.
 * @return {Array.<string|Object>}: the parsed list of tokens.
 * @private
 */
var handleBinaryOperator = function (operator, key, queryTokens) {
    var constructFlag = false;
    var newQueryTokens = [];

    for (var i = 0; i < queryTokens.length; i++) {
        var token = queryTokens[i];
        if (token == operator) {
            constructFlag = true;
        }
        else if (constructFlag == true) {
            newQueryTokens.pop();
            var t1 = newQueryTokens.pop();
            var t2 = token;

            // TODO: Check if t1 is undefined.

            var token = createDBQueryObject(t1, t2, key, operator);
            constructFlag = false;
        }

        newQueryTokens.push(token);
    };

    return newQueryTokens
};

/**
 * Creates a query object.
 * 
 * The query object should be in this format:
 *  eg. {'$and': [{'title': 'hi'}, {'title': 'bye'}]}
 *
 * @param t1 {}
 * @param key {string}: the field that the query belongs to.
 * @param operator {string}: the operator to handle (eg. '&&').
 * @return {Array.<string|Object>}: the parsed list of tokens.
 * @private
 */
var createDBQueryObject = function (t1, t2, key, operator) {
    var dbOperator = '';
    if (operator == '&&') {
        dbOperator = '$and';
    }
    else if (operator == '||') {
        dbOperator = '$or';
    }
    else {
        // TODO: Throw/raise some error.
    }

    var queryList = [];
    addTermsToQueryList(t1, key, queryList);
    addTermsToQueryList(t2, key, queryList);

    var queryObj = {};
    queryObj[dbOperator] = queryList;

    return queryObj;
};

var addTermsToQueryList = function (term, key, queryList) {
    if (typeof(term) == 'object') {
        queryList.push(term);
    }
    else {
        var termObj = {};
        termObj[key] = term;
        queryList.push(termObj);
    }
};

console.log(parser.parseBooleanQuery('A && B', 'title'));
console.log(parser.parseBooleanQuery('A && B && C', 'title'));
console.log(parser.parseBooleanQuery('A || B', 'title'));
console.log(parser.parseBooleanQuery('A && B || C && D', 'title'));