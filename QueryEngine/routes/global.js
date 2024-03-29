
var mongoose = require('mongoose');
var async = require('async');
var ObjectId = mongoose.Types.ObjectId;
var parser = require('./parser');

var Schema = mongoose.Schema;

var inf = 50;


//////////////////
//    Schema    //
//////////////////

var Author = mongoose.model('Author', 
    new Schema({
        name: String,
        createdDate: { type: Date, default: Date.now },
        papers: [{type: Schema.Types.ObjectId, ref:"Paper"}],
        coauthors:[{type: Schema.Types.ObjectId, ref:"Author"}]
    }), 'author');

var Paper = mongoose.model('Paper', 
    new Schema({
        title: String,
        doi: String,
        url: String,
        downloadlinks: { type: [String], default: [] },
        last_crawled: { type: Date, default: Date.now },
        abstract: String,
        year: { type: Number, min: 0, max: 2015 },
        authors: [{
            id: {type: Schema.Types.ObjectId, ref:"Author"}, 
            name: String
        }],
        citations: [{type: Schema.Types.ObjectId, ref:"Paper"}],
        cited_by: [{type: Schema.Types.ObjectId, ref:"Paper"}]
    }), 'paper');


var parseQuery = function(string, key) {
    var parsedQuery = parser.parseBooleanQuery(string, key);

    if ((parsedQuery == undefined) || (typeof(parsedQuery) == 'string')) {
        // use original string
        parsedQuery = {};
        parsedQuery[key] = {'$regex': '.*' + string + '.*', '$options': 'i'};
    }

    return parsedQuery;
};


var executeSearchQuery = function(queryObj, callback) {
    Paper.find(queryObj)
    .populate('citations', {'title':1, 'authors':1})
    .limit(200)
    .exec(function(err, papers) {
        if(err) {
            callback({'error': 'Unable to retrieve results.'});
        } else {
            callback(papers);    
        }
    });
};

var BFS = function(src, dest, callback) {
    var srcid = src._id;
    var destid = dest._id;

    if (srcid.equals(destid)) {
        callback({'distance': 0});
        return;
    }

    var srcCoauthors = src.coauthors;

    for(var i = 0; i < srcCoauthors.length; i++) {
        if (srcCoauthors[i].toString() == destid.toString()) {
            console.log('found');
            var parent = new Object();
            parent[srcid] = -1;
            parent[srcCoauthors[i]] = srcid;
            buildPath(1, parent, destid, callback);
            // callback({'distance': authorlevel + 1, 'path':getPath(parent, destid)});
            return;
        }
    }

    // List of author id and author level.
    var queue = srcCoauthors.map(function(authorid) {
        return [authorid, 1];
    });

    var visited = [srcid];
    visited = visited.concat(srcCoauthors);

    var parent = new Object();
    parent[srcid] = -1;
    for(var i = 0; i < srcCoauthors.length; i++) {
        parent[srcCoauthors[i]] = srcid;
    }

    BFSHelper(queue, visited, parent, destid, callback);
};

var isVisited = function(id, visited) {
    var idString = id.toString();

    for (var i = 0; i < visited.length; i++) {
        if (idString == visited[i].toString()) {
            return true;
        }
    }

    return false;
};

var BFSHelper = function(queue, visited, parent, destid, callback) {

    if (queue.length == 0 || authorlevel == inf) {
        callback({'distance': inf});
        return;
    }

    var node = queue.shift();
    var authorid = node[0];
    var authorlevel = node[1];

    Author.find({_id: authorid}, 'coauthors', function(err, results) {
        coauthorsList = results[0].coauthors;

        for(var i = 0; i < coauthorsList.length; i++) {
            var id = coauthorsList[i];
            
            if (id.toString() == destid.toString()) {
                console.log('here')
                if(!isVisited(id, visited)) {
                
                    visited.push(id);
                    parent[id] = authorid;
                    queue.push([id, authorlevel + 1]);
                }

                buildPath(authorlevel + 1, parent, destid, callback);
                // callback({'distance': authorlevel + 1, 'path':getPath(parent, destid)});
                return;
            }

            if(!isVisited(id, visited)) {
                
                visited.push(id);
                parent[id] = authorid;
                queue.push([id, authorlevel + 1]);
            }
        }

        return BFSHelper(queue, visited, parent, destid, callback);
    });
};

var buildPath = function(dist, parent, destid, callback) {

    var id = destid;
    var path = [id];
    while(parent[id] != -1) {
        path.unshift(parent[id]);
        id = parent[id];
    }

    Author.find({_id:{$in:path}}, 'name coauthors')
          .populate('coauthors', 'name')
          .exec(function(err, results){

        var idNameMap = new Object();
        for(var i = 0; i < results.length; i++) {
            idNameMap[results[i]._id.toString()] = {'name': results[i].name, 'coauthors':results[i].coauthors};
        }

        path = path.map(function(node){
            return {'id':node, 'name':idNameMap[node.toString()].name, 'coauthors':idNameMap[node.toString()].coauthors};
        });

        callback({'distance': dist, 'path': path});
    });
}


//////////////////////
//    Public API    //
/////////////////////


exports.getAuthor = function(id, callback) {
    Author.findOne({_id: id})
        .populate('coauthors', 'name')
        .populate('papers', 'title')
        .exec(function(err, results){
        callback(results);
    });
}

exports.getPaper = function(id, callback) {
    Paper.findOne({_id: id})
         .populate('citations', 'title')
         .populate('cited_by', 'title')
         .exec(function(err, results){
            callback(results);
        });
}

exports.populateAuthorNamesJson = function() {

    var fs = require('fs');
    var pth = 'authornames.json';

    fs.exists(pth, function(exists){

        if (!exists) {

            Author.find({}, {'_id': 0, 'name':1}, function(err, authorNames){

                authorNames = authorNames.map(function(e) {
                    return '"' + e.name + '"';
                });

                fs.writeFile(pth, authorNames, function(err) {
                    if(err) console.log(err);
                    else console.log('written author names to json file');
                });
            });
        }   
    });
};

exports.populatePaperTitlesJson = function() {

    var fs = require('fs');
    var pth = 'papertitles.json';

    fs.exists(pth, function(exists){

        if (!exists) {

            Paper.find({citations:{$exists:true}}, {'_id': 0, 'title':1}, function(err, results){

                results = results.map(function(e) {
                    var str = e.title.split('"').join('');
                    return '"' + str + '"';
                });

                fs.writeFile(pth, results, function(err) {
                    if(err) console.log(err);
                    else console.log('written author names to json file');
                });
            });
        }   
    });
};

exports.filterPaperByTitleAndAuthor = function(title, author, callback) {

    var queryTitle = {},
    queryAuthor = {},
    queryObj = {};

    if(title)
        queryTitle = parseQuery(title, 'title');

    if(author)
        queryAuthor = parseQuery(author, 'authors.name');

    queryObj = {$and:[queryTitle, queryAuthor]};
    
    executeSearchQuery(queryObj, callback);
};

exports.findPapersWithSimilarCitation = function(theTitle, callback) {
    Paper.find({title:theTitle}, 'citations')
    .populate('citations', 'cited_by')
    .exec(function(err, papers){
        var citations = papers[0].citations;

        var similarPaperIds = [];
        citations.forEach(function(citedPaper){
            var citedBy = citedPaper.get("cited_by");

            citedBy.forEach(function(c) {
                if(similarPaperIds.indexOf(c) == -1) {
                    similarPaperIds.push(c);
                }   
            });
        });

        Paper.find({_id:{$in:similarPaperIds}, title:{$ne:theTitle}})
        .populate('citations')
        .exec(function(err, papers){
            callback({'citations':citations.map(function(c){return c._id;}), 'papers': papers});
        });
    });
};

exports.getShortestPathBetweenAuthors = function(authorTo, authorFrom, callback) {
    Author.find({name: authorTo}, '_id coauthors')
    .exec(function (err, authorToResult) {
        if (err || authorToResult.length == 0) {
            callback({'error': 'No such author: ' + authorTo});
        }
        else {
            Author.find({name: authorFrom}, '_id coauthors')
            .exec(function (err, authorFromResult) {
                if (err || authorFromResult.length == 0) {
                    callback({'error': 'No such author: ' + authorFrom});
                }
                else {
                    BFS(authorFromResult[0], authorToResult[0], callback);
                }
            });
        }
    });
};